'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  UserCircle2,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type {
  ConsultWithStudent,
  ConsultationSummary,
} from '@/types/consult'
import type { StudentSearchResult } from '@/types/activity'
import { cn } from '@/lib/utils'

type Props = {
  initialAcademicYear: number
  availableYears: number[]
}

export function ConsultClient({ initialAcademicYear, availableYears }: Props) {
  const [year, setYear] = useState(initialAcademicYear)
  const [student, setStudent] = useState<StudentSearchResult | null>(null)
  const [consultations, setConsultations] = useState<ConsultWithStudent[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [viewItem, setViewItem] = useState<ConsultWithStudent | null>(null)

  const loadConsultations = useCallback(async () => {
    if (!student) {
      setConsultations([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/consult?student_id=${student.id}&year=${year}`
      )
      if (!res.ok) throw new Error()
      const json = await res.json()
      setConsultations(json.consultations ?? [])
    } catch {
      setConsultations([])
    } finally {
      setLoading(false)
    }
  }, [student, year])

  useEffect(() => {
    loadConsultations()
  }, [loadConsultations])

  const pendingFollowUp = consultations.filter(
    (c) =>
      !c.is_completed &&
      c.follow_up_date &&
      new Date(c.follow_up_date) <= new Date()
  )

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-6xl mx-auto px-8 py-8">
        <header className="mb-6">
          <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
            <Users className="h-3.5 w-3.5" />
            상담 기록
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-[#1E293B]">
                {year}학년도 상담 기록
              </h1>
              <p className="text-sm text-[#64748B] mt-1">
                학생을 선택하면 해당 학년도 상담 이력을 확인할 수 있습니다.
              </p>
            </div>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}학년도
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* 학생 검색 */}
        <div className="mb-6">
          <StudentComboBox
            academicYear={year}
            selected={student}
            onChange={setStudent}
          />
        </div>

        {/* 후속 조치 경고 */}
        {pendingFollowUp.length > 0 && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-amber-800 font-medium mb-1">
              <AlertTriangle className="h-4 w-4" />
              후속 조치 미완료 {pendingFollowUp.length}건
            </div>
            <ul className="space-y-1">
              {pendingFollowUp.slice(0, 3).map((c) => (
                <li key={c.id} className="text-xs text-amber-700">
                  · {c.consultation_date} 상담 → 후속 {c.follow_up_date} (
                  {c.is_completed ? '완료' : '미완료'})
                </li>
              ))}
            </ul>
          </div>
        )}

        {student && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#1E293B] inline-flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-[#3B82F6]" />
              {student.name} 상담 이력 ({consultations.length}건)
            </h2>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-[#3B82F6] hover:bg-[#2563EB]"
            >
              <Plus className="h-4 w-4 mr-1" />
              새 상담 기록
            </Button>
          </div>
        )}

        {/* 타임라인 */}
        {student && (
          <div className="space-y-3">
            {loading && (
              <div className="py-10 text-center text-sm text-[#64748B]">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                불러오는 중…
              </div>
            )}
            {!loading && consultations.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center">
                <p className="text-sm text-[#64748B]">
                  {student.name}의 {year}학년도 상담 기록이 없습니다.
                </p>
              </div>
            )}
            {consultations.map((c) => {
              const summary = c.structured_summary as ConsultationSummary | null
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setViewItem(c)}
                  className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-[#3B82F6]/40 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-3.5 w-3.5 text-[#64748B]" />
                        <span className="text-xs font-mono text-[#64748B]">
                          {c.consultation_date}
                        </span>
                        {c.is_completed ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                          >
                            완료
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                          >
                            진행 중
                          </Badge>
                        )}
                      </div>
                      {summary ? (
                        <>
                          <p className="text-sm font-medium text-[#1E293B] mb-1">
                            {summary.agenda?.slice(0, 2).join(' · ') || '안건 미정'}
                          </p>
                          <p className="text-xs text-[#475569] line-clamp-2">
                            {summary.details}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-[#475569] line-clamp-2">
                          {c.raw_input?.slice(0, 100) || '내용 없음'}
                        </p>
                      )}
                      {c.follow_up_date && (
                        <p className="text-[11px] text-amber-600 mt-1">
                          후속 조치: {c.follow_up_date}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#94A3B8] shrink-0 mt-1" />
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* 새 상담 다이얼로그 */}
        {student && (
          <CreateConsultDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            student={student}
            academicYear={year}
            onSaved={loadConsultations}
          />
        )}

        {/* 상세 보기 */}
        {viewItem && (
          <ConsultDetailDialog
            open={!!viewItem}
            onOpenChange={(v) => {
              if (!v) setViewItem(null)
            }}
            item={viewItem}
            onChanged={loadConsultations}
          />
        )}
      </div>
    </div>
  )
}

// ─── 학생 검색 (세특 페이지와 유사) ──────────────────────────

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
        const json = await res.json()
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
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <UserCircle2 className="h-8 w-8 text-[#3B82F6] shrink-0" />
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
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange(null)
            setQuery('')
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="학번 또는 이름으로 학생 검색"
          className="pl-9 h-11 bg-white border-slate-200"
        />
      </div>
      {open && query && (
        <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-lg border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto">
          {loading && <p className="p-3 text-xs text-[#64748B]">검색 중…</p>}
          {!loading && results.length === 0 && (
            <p className="p-3 text-xs text-[#64748B]">일치하는 학생이 없습니다.</p>
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
              <p className="text-sm">
                <span className="font-mono text-xs text-[#64748B]">
                  {s.student_number}
                </span>{' '}
                <span className="font-medium">{s.name}</span>
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 새 상담 생성 ────────────────────────────────────────────

function CreateConsultDialog({
  open,
  onOpenChange,
  student,
  academicYear,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  student: StudentSearchResult
  academicYear: number
  onSaved: () => void
}) {
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  const [date, setDate] = useState(todayStr)
  const [attendees, setAttendees] = useState('')
  const [rawInput, setRawInput] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [structuring, setStructuring] = useState(false)
  const [structuredSummary, setStructuredSummary] = useState<ConsultationSummary | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 음성 입력
  const [speechEnabled, setSpeechEnabled] = useState(false)
  const [speechWarningOpen, setSpeechWarningOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => {
    if (!open) {
      setDate(todayStr)
      setAttendees('')
      setRawInput('')
      setFollowUpDate('')
      setStructuredSummary(null)
      setError(null)
      setSpeechEnabled(false)
      setListening(false)
    }
  }, [open, todayStr])

  const handleStructure = async () => {
    if (!rawInput.trim()) return
    setStructuring(true)
    setError(null)
    try {
      const res = await fetch('/api/consult/structurize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_input: rawInput }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message || j.error || '구조화 실패')
      }
      const json = await res.json()
      setStructuredSummary(json.summary)
      if (json.summary?.follow_up_date && !followUpDate) {
        setFollowUpDate(json.summary.follow_up_date)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '구조화 실패')
    } finally {
      setStructuring(false)
    }
  }

  const handleSave = async () => {
    if (!date) return setError('상담 일자를 입력하세요.')
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: student.id,
          academic_year: academicYear,
          consultation_date: date,
          attendees: attendees.trim() || null,
          raw_input: rawInput.trim() || null,
          structured_summary: structuredSummary,
          follow_up_date: followUpDate || null,
          is_completed: false,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message || j.error || '저장 실패')
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const toggleSpeech = () => {
    if (!speechEnabled) {
      setSpeechWarningOpen(true)
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    try {
      const win = window as unknown as Record<string, unknown>
      const SR = (win.SpeechRecognition ?? win.webkitSpeechRecognition) as
        | (new () => {
            continuous: boolean
            interimResults: boolean
            lang: string
            onresult: ((event: { results: { [index: number]: { 0: { transcript: string } }; length: number } }) => void) | null
            onerror: (() => void) | null
            onend: (() => void) | null
            start: () => void
            stop: () => void
          })
        | undefined
      if (!SR) {
        setError('이 브라우저는 음성 인식을 지원하지 않습니다.')
        return
      }
      const recognition = new SR()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'ko-KR'
      recognition.onresult = (event) => {
        let transcript = ''
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        setRawInput((prev) => {
          const base = prev.endsWith('\n') ? prev : prev ? prev + '\n' : ''
          return base + transcript
        })
      }
      recognition.onerror = () => setListening(false)
      recognition.onend = () => setListening(false)
      recognition.start()
      recognitionRef.current = recognition as unknown as typeof recognitionRef.current
      setListening(true)
    } catch {
      setError('음성 인식 시작 실패')
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
            <DialogTitle>새 상담 기록</DialogTitle>
            <DialogDescription className="text-xs">
              {student.name} ({student.student_number})
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">상담 일자</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">참석자</Label>
                <Input
                  value={attendees}
                  onChange={(e) => setAttendees(e.target.value)}
                  placeholder="예: 담임, 학부모"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">상담 내용 (자유 메모)</Label>
                <button
                  type="button"
                  onClick={toggleSpeech}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition',
                    listening
                      ? 'bg-red-100 text-red-700 animate-pulse'
                      : speechEnabled
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-slate-100 text-[#94A3B8] hover:bg-slate-200'
                  )}
                >
                  {listening ? (
                    <><Mic className="h-3 w-3" /> 듣는 중…</>
                  ) : speechEnabled ? (
                    <><Mic className="h-3 w-3" /> 음성</>
                  ) : (
                    <><MicOff className="h-3 w-3" /> 음성 OFF</>
                  )}
                </button>
              </div>
              <Textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                rows={6}
                placeholder="상담 내용을 자유롭게 메모하세요. AI가 안건·합의·후속조치를 자동 정리해줍니다."
                className="bg-[#F7F6F3] border-transparent focus-visible:border-[#3B82F6]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleStructure}
                disabled={structuring || !rawInput.trim()}
                variant="outline"
              >
                {structuring ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                AI 구조화
              </Button>
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs text-[#64748B]">후속 일자 (선택)</Label>
                <Input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
              </div>
            </div>

            {structuredSummary && (
              <div className="rounded-xl border border-[#EEF4FF] bg-[#EEF4FF]/30 p-4 space-y-3">
                <p className="text-[11px] uppercase tracking-wider text-[#3B82F6] font-semibold">
                  AI 구조화 결과
                </p>
                <InfoRow label="참석자" value={structuredSummary.attendees} />
                <InfoRow label="안건" value={structuredSummary.agenda?.join(' · ') || '-'} />
                <InfoRow label="상세" value={structuredSummary.details} />
                <InfoRow label="합의" value={structuredSummary.agreements?.join(' / ') || '-'} />
                <InfoRow label="후속" value={structuredSummary.follow_up || '없음'} />
                {structuredSummary.follow_up_date && (
                  <InfoRow label="후속 일자" value={structuredSummary.follow_up_date} />
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-200">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#3B82F6] hover:bg-[#2563EB]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 음성 경고 모달 */}
      <Dialog open={speechWarningOpen} onOpenChange={setSpeechWarningOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base inline-flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              음성 입력 안내
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#475569] leading-relaxed">
            음성 인식은 브라우저에 따라 <strong>외부 서버로 음성이 전송</strong>
            될 수 있습니다. 상담 내용에 민감한 개인정보가 포함된 경우{' '}
            <strong>텍스트 입력을 권장</strong>합니다.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSpeechWarningOpen(false)}
            >
              텍스트로 입력
            </Button>
            <Button
              onClick={() => {
                setSpeechEnabled(true)
                setSpeechWarningOpen(false)
              }}
              className="bg-amber-500 hover:bg-amber-600"
            >
              동의하고 활성화
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── 상세 보기 ───────────────────────────────────────────────

function ConsultDetailDialog({
  open,
  onOpenChange,
  item,
  onChanged,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  item: ConsultWithStudent
  onChanged: () => void
}) {
  const summary = item.structured_summary as ConsultationSummary | null
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)

  const handleToggleComplete = async () => {
    setToggling(true)
    try {
      await fetch(`/api/consult/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !item.is_completed }),
      })
      onChanged()
      onOpenChange(false)
    } catch {
      /* ignore */
    } finally {
      setToggling(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('이 상담 기록을 삭제할까요?')) return
    setDeleting(true)
    try {
      await fetch(`/api/consult/${item.id}`, { method: 'DELETE' })
      onChanged()
      onOpenChange(false)
    } catch {
      /* ignore */
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="text-base inline-flex items-center gap-2">
            {item.consultation_date} 상담
            {item.is_completed ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">완료</Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">진행 중</Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {item.student_name} ({item.student_number})
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {item.attendees && <InfoRow label="참석자" value={item.attendees} />}

          {item.raw_input && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">원본 메모</p>
              <p className="text-sm text-[#1E293B] whitespace-pre-wrap bg-[#F7F6F3] rounded-lg px-3 py-2">
                {item.raw_input}
              </p>
            </div>
          )}

          {summary && (
            <div className="rounded-xl border border-[#EEF4FF] bg-[#EEF4FF]/30 p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-wider text-[#3B82F6] font-semibold">
                AI 구조화 결과
              </p>
              <InfoRow label="안건" value={summary.agenda?.join(' · ') || '-'} />
              <InfoRow label="상세" value={summary.details} />
              <InfoRow label="합의" value={summary.agreements?.join(' / ') || '-'} />
              <InfoRow label="후속" value={summary.follow_up || '없음'} />
              {summary.follow_up_date && (
                <InfoRow label="후속 일자" value={summary.follow_up_date} />
              )}
            </div>
          )}

          {item.follow_up_date && (
            <InfoRow label="후속 조치 일자" value={item.follow_up_date} />
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-200 gap-2">
          <Button
            variant="ghost"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-600 hover:bg-red-50 mr-auto"
          >
            <Trash2 className="h-4 w-4 mr-1" />
          </Button>
          <Button
            variant="outline"
            onClick={handleToggleComplete}
            disabled={toggling}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {item.is_completed ? '미완료로 변경' : '완료 처리'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
      <span className="text-[#64748B] text-xs pt-0.5">{label}</span>
      <span className="text-[#1E293B]">{value}</span>
    </div>
  )
}
