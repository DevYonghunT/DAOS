'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckSquare,
  Sparkles,
  Loader2,
  AlertTriangle,
  Info,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ByteMeter } from '@/components/activity/byte-meter'
import { AnnotatedPreview } from '@/components/review/annotated-preview'
import {
  RECORD_CATEGORIES,
  findCategory,
  type RecordCategoryKey,
} from '@/lib/activity/categories'
import { runLocalChecks, type LocalViolation } from '@/lib/review/local-checks'
import type { ReviewSuggestion } from '@/lib/review/schema'
import { cn } from '@/lib/utils'

type ReviewApiResponse = {
  local: {
    violations: LocalViolation[]
    byteInfo: {
      used: number
      limit: number
      ratio: number
      over: boolean
    }
  }
  llm:
    | null
    | {
        overall_comment: string | null
        suggestions: ReviewSuggestion[]
      }
  llm_error: string | null
}

type Tab = 'local' | 'ai'

export function ReviewClient({ initialCategory }: { initialCategory?: RecordCategoryKey }) {
  const [category, setCategory] = useState<RecordCategoryKey>(
    initialCategory ?? 'autonomous_council'
  )
  const [text, setText] = useState('')
  const [tab, setTab] = useState<Tab>('local')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiData, setAiData] = useState<ReviewApiResponse['llm']>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const categoryMeta = findCategory(category)!
  const byteLimit = categoryMeta.limitBytes

  // 로컬 검수는 텍스트 입력 즉시 재계산
  const local = useMemo(
    () => runLocalChecks(text, byteLimit),
    [text, byteLimit]
  )

  const runAiReview = useCallback(async () => {
    if (!text.trim()) return
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
      if (json.llm_error) {
        setAiError(json.llm_error)
      }
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

  const copySuggestion = async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1200)
    } catch {
      /* ignore */
    }
  }

  const errorCount = local.violations.filter((v) => v.severity === 'error').length
  const warnCount = local.violations.filter((v) => v.severity === 'warning').length

  // 탭 초기화
  useEffect(() => {
    setAiData(null)
    setAiError(null)
  }, [category])

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-7xl mx-auto px-8 py-8">
        {/* 헤더 */}
        <header className="mb-6">
          <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
            <CheckSquare className="h-3.5 w-3.5" />
            학생부 검수
          </div>
          <h1 className="text-2xl font-bold text-[#1E293B] mb-1">
            학생부 기재 검수
          </h1>
          <p className="text-sm text-[#64748B]">
            금지 표현·바이트 한도는 즉시 로컬 검수로, 맞춤법·문맥 제안은 AI가 추가 검토합니다.
          </p>
        </header>

        {/* 설정 바 */}
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">기재 영역</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as RecordCategoryKey)}
            >
              <SelectTrigger className="h-9 w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECORD_CATEGORIES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label} — {c.limitBytes}B
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <ByteMeter
              used={local.byteInfo.used}
              limit={byteLimit}
              caption={`${categoryMeta.label} 한도 기준`}
            />
          </div>
          <Button
            onClick={runAiReview}
            disabled={aiLoading || !text.trim()}
            className="h-9 bg-[#3B82F6] hover:bg-[#2563EB]"
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            AI 검수
          </Button>
        </div>

        {/* 본문 2컬럼 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
          {/* 좌측: 편집기 + 미리보기 */}
          <section className="space-y-3">
            <div>
              <Label className="text-xs mb-1.5 block">입력 (세특 원문)</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder={`검수할 세특 문장을 붙여 넣거나 직접 작성하세요.\n예: 과학 탐구 수행평가에서 에너지 보존 법칙을 스스로 실험 설계로 증명하였으며...`}
                className="bg-white border-slate-200 font-pretendard text-sm leading-relaxed"
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block text-[#64748B]">
                미리보기 (위반 구간 하이라이트)
              </Label>
              <AnnotatedPreview text={text} violations={local.violations} />
            </div>
          </section>

          {/* 우측: 검수 결과 */}
          <aside className="space-y-3">
            {/* 통계 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] uppercase tracking-wider text-[#94A3B8] mb-2">
                검수 요약
              </p>
              <div className="flex gap-2 flex-wrap">
                <StatChip
                  icon={<AlertTriangle className="h-3 w-3" />}
                  label="에러"
                  value={errorCount}
                  color="red"
                />
                <StatChip
                  icon={<Info className="h-3 w-3" />}
                  label="주의"
                  value={warnCount}
                  color="amber"
                />
                <StatChip
                  icon={<CheckCircle2 className="h-3 w-3" />}
                  label="바이트"
                  value={`${local.byteInfo.used}/${byteLimit}`}
                  color={local.byteInfo.over ? 'red' : 'slate'}
                />
              </div>
            </div>

            {/* 탭 */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex border-b border-slate-200">
                <TabBtn active={tab === 'local'} onClick={() => setTab('local')}>
                  로컬 검수 ({local.violations.length})
                </TabBtn>
                <TabBtn active={tab === 'ai'} onClick={() => setTab('ai')}>
                  AI 제안{' '}
                  {aiData ? `(${aiData.suggestions.length})` : ''}
                </TabBtn>
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                {tab === 'local' && (
                  <LocalViolationsList violations={local.violations} />
                )}
                {tab === 'ai' && (
                  <AiSuggestionsList
                    loading={aiLoading}
                    error={aiError}
                    data={aiData}
                    onApply={applySuggestion}
                    onCopy={copySuggestion}
                    copiedId={copiedId}
                    hasText={!!text.trim()}
                    onRun={runAiReview}
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

function StatChip({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  color: 'red' | 'amber' | 'slate'
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs',
        color === 'red' && 'bg-red-50 text-red-700',
        color === 'amber' && 'bg-amber-50 text-amber-700',
        color === 'slate' && 'bg-slate-100 text-slate-700'
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

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
        'flex-1 px-4 py-2.5 text-sm font-medium transition relative',
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

function LocalViolationsList({ violations }: { violations: LocalViolation[] }) {
  if (violations.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
        <p className="text-sm text-[#475569]">
          로컬 검수에서 발견된 문제가 없습니다.
        </p>
        <p className="text-[11px] text-[#64748B] mt-1">
          금지 표현·바이트 한도 모두 정상입니다.
        </p>
      </div>
    )
  }
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
                <span className="text-[#64748B] ml-1 text-xs">
                  (위치 {v.start}–{v.end})
                </span>
              </p>
              <p className="text-xs text-[#475569] mt-0.5">{v.reason}</p>
              {v.guide && (
                <p className="text-[11px] text-[#94A3B8] mt-1">{v.guide}</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function AiSuggestionsList({
  loading,
  error,
  data,
  onApply,
  onCopy,
  copiedId,
  hasText,
  onRun,
}: {
  loading: boolean
  error: string | null
  data: ReviewApiResponse['llm']
  onApply: (orig: string, next: string) => void
  onCopy: (id: string, content: string) => void
  copiedId: string | null
  hasText: boolean
  onRun: () => void
}) {
  if (loading) {
    return (
      <div className="px-4 py-8 text-center text-sm text-[#64748B] inline-flex items-center justify-center gap-2 w-full">
        <Loader2 className="h-4 w-4 animate-spin" />
        AI가 문맥을 검토하고 있습니다…
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
        <Sparkles className="h-6 w-6 text-[#3B82F6] mx-auto mb-2" />
        <p className="text-sm text-[#475569] mb-3">
          AI 검수는 수동으로 실행합니다.
        </p>
        <Button
          size="sm"
          onClick={onRun}
          disabled={!hasText}
          className="bg-[#3B82F6] hover:bg-[#2563EB]"
        >
          AI 검수 실행
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
        <div className="px-4 py-6 text-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-sm text-[#475569]">추가 제안 없음</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.suggestions.map((s, i) => {
            const id = `sg-${i}`
            return (
              <li key={id} className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal bg-slate-100 text-slate-700 border-slate-200"
                  >
                    {categoryLabel(s.category)}
                  </Badge>
                  <span className="text-[11px] text-[#64748B]">{s.reason}</span>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-[#94A3B8]">원문</div>
                  <p className="text-sm bg-red-50/50 border-l-2 border-red-300 pl-2 py-1 rounded-r">
                    {s.original_sentence}
                  </p>
                  <div className="text-xs text-[#94A3B8] mt-2">제안</div>
                  <p className="text-sm bg-emerald-50/60 border-l-2 border-emerald-400 pl-2 py-1 rounded-r">
                    {s.suggestion}
                  </p>
                </div>
                <div className="flex gap-1.5 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => onCopy(id, s.suggestion)}
                  >
                    {copiedId === id ? (
                      <Check className="h-3 w-3 mr-1" />
                    ) : (
                      <Copy className="h-3 w-3 mr-1" />
                    )}
                    복사
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onApply(s.original_sentence, s.suggestion)}
                  >
                    원문 교체
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function categoryLabel(c: ReviewSuggestion['category']): string {
  switch (c) {
    case 'spelling':
      return '맞춤법'
    case 'grammar':
      return '문법'
    case 'policy':
      return '지침'
    case 'tone':
      return '어조'
    case 'clarity':
      return '명료성'
    default:
      return c
  }
}
