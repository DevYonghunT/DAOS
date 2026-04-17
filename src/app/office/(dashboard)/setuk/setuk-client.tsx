'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  FileText,
  Loader2,
  Save,
  Search,
  Sparkles,
  UserCircle2,
  UsersRound,
  X,
  BookOpenCheck,
  StickyNote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ByteMeter } from '@/components/activity/byte-meter'
import { AnnotatedPreview } from '@/components/review/annotated-preview'
import {
  categoriesForGrade,
  findCategory,
  RECORD_CATEGORIES,
  type RecordCategoryKey,
} from '@/lib/activity/categories'
import {
  runLocalChecks,
  type LocalViolation,
} from '@/lib/review/local-checks'
import type { ReviewSuggestion } from '@/lib/review/schema'
import type { StudentSearchResult } from '@/types/activity'
import { cn } from '@/lib/utils'

type Tab = 'local' | 'ai'

type ReviewApiResponse = {
  local: {
    violations: LocalViolation[]
    byteInfo: { used: number; limit: number; ratio: number; over: boolean }
  }
  llm: null | {
    overall_comment: string | null
    suggestions: ReviewSuggestion[]
  }
  llm_error: string | null
}

type Props = {
  initialAcademicYear: number
  availableYears: number[]
}

export function SetukClient({ initialAcademicYear, availableYears }: Props) {
  const [academicYear, setAcademicYear] = useState<number>(initialAcademicYear)
  const [student, setStudent] = useState<StudentSearchResult | null>(null)
  const [category, setCategory] = useState<RecordCategoryKey | ''>('')
  const [keywords, setKeywords] = useState('')
  const [text, setText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('local')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiData, setAiData] = useState<ReviewApiResponse['llm']>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 학생 학년에 맞는 카테고리만 노출
  const availableCategories = useMemo(() => {
    const g = student?.grade ?? null
    return g != null ? categoriesForGrade(g) : RECORD_CATEGORIES
  }, [student])

  // 유효하지 않은 카테고리 리셋
  useEffect(() => {
    if (
      category &&
      !availableCategories.some((c) => c.key === category)
    ) {
      setCategory('')
    }
  }, [availableCategories, category])

  const categoryMeta = category ? findCategory(category) : null
  const byteLimit = categoryMeta?.limitBytes ?? 1500

  const local = useMemo(
    () => runLocalChecks(text, byteLimit),
    [text, byteLimit]
  )

  const canGenerate = !!student && !!category && !generating
  const canSave = !!student && !!category && text.trim().length > 0

  const handleGenerate = async () => {
    if (!canGenerate) return
    setGenerating(true)
    setGenError(null)
    setText('') // 이전 결과 초기화
    setAiData(null)
    setAiError(null)
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch('/api/setuk/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: student!.id,
          record_category: category,
          academic_year: academicYear,
          keywords: keywords.trim() || undefined,
        }),
        signal: ctrl.signal,
      })

      if (!res.ok) {
        const raw = await res.text()
        let detail = `HTTP ${res.status}`
        try {
          const j = JSON.parse(raw)
          detail =
            j.message || j.error || (raw ? raw.slice(0, 200) : detail)
        } catch {
          if (raw) detail = raw.slice(0, 200)
        }
        console.error('[setuk] 생성 API 에러', res.status, raw)
        throw new Error(detail)
      }
      if (!res.body) throw new Error('스트림 응답 없음')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          accumulated += chunk
          setText(accumulated)
        }
      } catch (streamErr) {
        console.error('[setuk] 스트림 읽기 중단', streamErr)
        throw new Error(
          accumulated
            ? '스트림 도중 끊김. 받은 부분까지만 표시됩니다.'
            : '스트리밍 중 에러: ' +
              (streamErr instanceof Error ? streamErr.message : 'unknown')
        )
      }
      if (!accumulated.trim()) {
        throw new Error(
          '응답이 비어있습니다. (모델 응답이 없거나 도중에 끊겼습니다)'
        )
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        // 사용자 중단
      } else {
        setGenError(e instanceof Error ? e.message : '초안 생성 실패')
      }
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }

  const stopGenerate = () => {
    abortRef.current?.abort()
    setGenerating(false)
  }

  const runAiReview = useCallback(async () => {
    if (!text.trim() || !category) return
    setAiLoading(true)
    setAiError(null)
    setAiData(null)
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          record_category: category,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message || j.error || '검수 실패')
      }
      const json = (await res.json()) as ReviewApiResponse
      if (json.llm_error) setAiError(json.llm_error)
      setAiData(json.llm)
      setTab('ai')
    } catch (e) {
      setAiError(e instanceof Error ? e.message : '검수 실패')
    } finally {
      setAiLoading(false)
    }
  }, [text, category])

  const applySuggestion = (orig: string, next: string) => {
    if (!orig) return
    if (!text.includes(orig)) {
      alert('원문 문장을 찾지 못해 자동 교체할 수 없습니다. 수동으로 수정해주세요.')
      return
    }
    setText((t) => t.replace(orig, next))
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/setuk/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: student!.id,
          student_label: `${student!.student_number} ${student!.name}`,
          academic_year: academicYear,
          subject: category,
          grade_class:
            student!.grade != null
              ? `${student!.grade}-${student!.class_number}-${student!.number_in_class ?? '?'}`
              : null,
          keywords: keywords.trim() || null,
          draft: null,
          final_text: text,
          status: 'draft',
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message || j.error || '저장 실패')
      }
      setSaveMsg('저장되었습니다.')
      setTimeout(() => setSaveMsg(null), 2000)
    } catch (e) {
      setSaveMsg(e instanceof Error ? `저장 실패: ${e.message}` : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const errorCount = local.violations.filter((v) => v.severity === 'error').length
  const warnCount = local.violations.filter((v) => v.severity === 'warning').length

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* 헤더 */}
        <header className="mb-6">
          <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
            <FileText className="h-3.5 w-3.5" />
            세특 작성 도우미
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-[#1E293B]">
                {academicYear}학년도 세특 초안 작성
              </h1>
              <p className="text-sm text-[#64748B] mt-1">
                학생과 영역을 고르면 Phase 3의 참여 활동 데이터를 기반으로 초안을 만들어줍니다. 이름은 AI 호출 전 라벨로 비식별화됩니다.
              </p>
            </div>
            <Select
              value={String(academicYear)}
              onValueChange={(v) => setAcademicYear(Number(v))}
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}학년도
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* 컨트롤 바 */}
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StudentComboBox
              academicYear={academicYear}
              selected={student}
              onChange={setStudent}
            />
            <div className="space-y-1.5">
              <Label className="text-xs">기재 영역</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as RecordCategoryKey)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="영역 선택..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label} · {c.limitBytes}B
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <StickyNote className="h-3.5 w-3.5" />
              추가 키워드 / 메모 (선택)
            </Label>
            <Textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              rows={2}
              placeholder="예: 리더십 강조, 과학적 호기심 부각, 특정 학생 관찰 포인트 등"
              className="bg-[#F7F6F3] border-transparent focus-visible:border-[#3B82F6]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!generating ? (
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="bg-[#3B82F6] hover:bg-[#2563EB]"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                초안 생성
              </Button>
            ) : (
              <Button onClick={stopGenerate} variant="outline">
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                중단
              </Button>
            )}
            <Button
              onClick={runAiReview}
              disabled={!text.trim() || aiLoading}
              variant="outline"
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <BookOpenCheck className="h-4 w-4 mr-1" />
              )}
              AI 검수
            </Button>
            <div className="flex-1" />
            {saveMsg && (
              <span
                className={cn(
                  'text-xs',
                  saveMsg.startsWith('저장되었습니다')
                    ? 'text-emerald-600'
                    : 'text-red-600'
                )}
              >
                {saveMsg}
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="bg-[#1B2A4A] hover:bg-[#1B2A4A]/90"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              저장
            </Button>
          </div>
          {genError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {genError}
            </p>
          )}
        </div>

        {/* 본문 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
          <section className="space-y-3">
            {/* 편집기 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs">초안 (직접 편집 가능)</Label>
                <span className="text-[11px] text-[#64748B]">
                  로컬 검수는 입력 즉시 반영됩니다
                </span>
              </div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder="초안 생성 버튼을 누르면 이 영역에 AI가 작성한 초안이 나타납니다. 또는 직접 입력해도 됩니다."
                className="bg-white border-slate-200 font-pretendard text-sm leading-relaxed"
                disabled={generating}
              />
            </div>

            {/* 바이트 미터 */}
            {category && (
              <ByteMeter
                used={local.byteInfo.used}
                limit={byteLimit}
                caption={`${categoryMeta?.label} 한도`}
              />
            )}

            {/* 미리보기 */}
            <div>
              <Label className="text-xs mb-1.5 block text-[#64748B]">
                미리보기 (위반 구간 하이라이트)
              </Label>
              <AnnotatedPreview
                text={text}
                violations={local.violations}
              />
            </div>
          </section>

          <aside className="space-y-3">
            {/* 학생 정보 + 검수 요약 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              {student ? (
                <div className="flex items-start gap-3">
                  <UserCircle2 className="h-8 w-8 text-[#3B82F6] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1E293B]">
                      {student.name}
                    </p>
                    <p className="text-xs text-[#64748B] font-mono">
                      {student.student_number}
                    </p>
                    {student.grade != null && (
                      <p className="text-xs text-[#475569] mt-0.5">
                        {student.grade}-{student.class_number}-
                        {student.number_in_class ?? '?'}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#94A3B8]">
                  학생을 선택하면 정보가 여기에 표시됩니다.
                </p>
              )}
              <div className="pt-2 border-t border-slate-100 flex gap-2 flex-wrap">
                <Chip color="red" label="에러" value={errorCount} />
                <Chip color="amber" label="주의" value={warnCount} />
                <Chip
                  color={local.byteInfo.over ? 'red' : 'slate'}
                  label="바이트"
                  value={`${local.byteInfo.used}/${byteLimit}`}
                />
              </div>
            </div>

            {/* 검수 탭 */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex border-b border-slate-200">
                <TabBtn
                  active={tab === 'local'}
                  onClick={() => setTab('local')}
                >
                  로컬 검수 ({local.violations.length})
                </TabBtn>
                <TabBtn active={tab === 'ai'} onClick={() => setTab('ai')}>
                  AI 제안
                  {aiData ? ` (${aiData.suggestions.length})` : ''}
                </TabBtn>
              </div>
              <div className="max-h-[440px] overflow-y-auto">
                {tab === 'local' &&
                  (local.violations.length === 0 ? (
                    <EmptyLocal />
                  ) : (
                    <LocalList violations={local.violations} />
                  ))}
                {tab === 'ai' && (
                  <AiList
                    loading={aiLoading}
                    error={aiError}
                    data={aiData}
                    hasText={!!text.trim()}
                    onRun={runAiReview}
                    onApply={applySuggestion}
                  />
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Student ComboBox — 단일 선택 autocomplete
// ────────────────────────────────────────────────────────────────────────

function StudentComboBox({
  academicYear,
  selected,
  onChange,
}: {
  academicYear: number
  selected: StudentSearchResult | null
  onChange: (s: StudentSearchResult | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StudentSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!query.trim() || selected) {
      setResults([])
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/activity/students/search?q=${encodeURIComponent(query)}&academic_year=${academicYear}`,
          { signal: ctrl.signal }
        )
        if (!res.ok) throw new Error()
        const json = (await res.json()) as { students: StudentSearchResult[] }
        setResults(json.students)
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query, academicYear, selected])

  if (selected) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1">
          <UsersRound className="h-3.5 w-3.5" />
          대상 학생
        </Label>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1E293B]">
              <span className="font-mono text-xs text-[#64748B] mr-2">
                {selected.student_number}
              </span>
              {selected.name}
            </p>
            {selected.grade != null && (
              <p className="text-[11px] text-[#64748B]">
                {selected.grade}-{selected.class_number}-
                {selected.number_in_class ?? '?'}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => {
              onChange(null)
              setQuery('')
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5 relative">
      <Label className="text-xs flex items-center gap-1">
        <UsersRound className="h-3.5 w-3.5" />
        대상 학생
      </Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="학번 또는 이름으로 검색"
          className="pl-8 bg-[#F7F6F3] border-transparent focus-visible:border-[#3B82F6]"
        />
      </div>
      {open && query && (
        <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-lg border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto">
          {loading && (
            <p className="p-3 text-xs text-[#64748B]">검색 중…</p>
          )}
          {!loading && results.length === 0 && (
            <p className="p-3 text-xs text-[#64748B]">
              일치하는 학생이 없습니다.
            </p>
          )}
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(s)
                setQuery('')
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 hover:bg-[#F7F6F3] transition"
            >
              <p className="text-sm text-[#1E293B]">
                <span className="font-mono text-xs text-[#64748B]">
                  {s.student_number}
                </span>{' '}
                <span className="font-medium">{s.name}</span>
              </p>
              <p className="text-[11px] text-[#64748B]">
                {s.grade != null
                  ? `${s.grade}-${s.class_number}-${s.number_in_class ?? '?'}`
                  : '소속 정보 없음'}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// UI helpers
// ────────────────────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 px-4 py-2.5 text-sm font-medium relative transition',
        active ? 'text-[#1E293B]' : 'text-[#64748B] hover:text-[#1E293B]'
      )}
    >
      {children}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6]" />
      )}
    </button>
  )
}

function Chip({
  color,
  label,
  value,
}: {
  color: 'red' | 'amber' | 'slate'
  label: string
  value: number | string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs',
        color === 'red' && 'bg-red-50 text-red-700',
        color === 'amber' && 'bg-amber-50 text-amber-700',
        color === 'slate' && 'bg-slate-100 text-slate-700'
      )}
    >
      <span className="font-medium">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
  )
}

function EmptyLocal() {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm text-[#475569]">
        로컬 검수에서 발견된 문제가 없습니다.
      </p>
    </div>
  )
}

function LocalList({ violations }: { violations: LocalViolation[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {violations.map((v, i) => (
        <li key={`${v.ruleId}-${v.start}-${i}`} className="px-4 py-3">
          <div className="flex items-start gap-2">
            <Badge
              variant="outline"
              className={cn(
                'shrink-0 text-[10px] font-normal',
                v.severity === 'error'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              )}
            >
              {v.severity === 'error' ? '금지' : '주의'}
            </Badge>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#1E293B]">
                <span className="font-semibold">&quot;{v.matched}&quot;</span>
              </p>
              <p className="text-xs text-[#475569] mt-0.5">{v.reason}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function AiList({
  loading,
  error,
  data,
  hasText,
  onRun,
  onApply,
}: {
  loading: boolean
  error: string | null
  data: ReviewApiResponse['llm']
  hasText: boolean
  onRun: () => void
  onApply: (orig: string, next: string) => void
}) {
  if (loading) {
    return (
      <div className="px-4 py-8 flex items-center justify-center gap-2 text-sm text-[#64748B]">
        <Loader2 className="h-4 w-4 animate-spin" />
        AI 검수 중…
      </div>
    )
  }
  if (error) {
    return (
      <div className="px-4 py-6">
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="px-4 py-8 text-center">
        <Sparkles className="h-5 w-5 text-[#3B82F6] mx-auto mb-2" />
        <p className="text-sm text-[#475569] mb-3">AI 검수는 수동 실행</p>
        <Button
          size="sm"
          onClick={onRun}
          disabled={!hasText}
          className="bg-[#3B82F6] hover:bg-[#2563EB]"
        >
          검수 실행
        </Button>
      </div>
    )
  }
  return (
    <div>
      {data.overall_comment && (
        <div className="px-4 py-3 border-b border-slate-100 bg-[#F7F6F3]">
          <p className="text-xs text-[#475569]">
            <span className="font-semibold text-[#1E293B]">총평 </span>
            {data.overall_comment}
          </p>
        </div>
      )}
      {data.suggestions.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-[#475569]">
          추가 제안 없음
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.suggestions.map((s, i) => (
            <li key={i} className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal bg-slate-100 text-slate-700 border-slate-200"
                >
                  {s.category}
                </Badge>
                <span className="text-[11px] text-[#64748B]">{s.reason}</span>
              </div>
              <p className="text-sm bg-red-50/50 border-l-2 border-red-300 pl-2 py-1 rounded-r">
                {s.original_sentence}
              </p>
              <p className="text-sm bg-emerald-50/60 border-l-2 border-emerald-400 pl-2 py-1 rounded-r">
                {s.suggestion}
              </p>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() =>
                    onApply(s.original_sentence, s.suggestion)
                  }
                >
                  원문 교체
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
