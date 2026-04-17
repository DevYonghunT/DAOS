'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Sparkles, Trash2, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EVENT_COLOR_STYLES, normalizeColor } from '@/lib/calendar/colors'
import type { EventColor, EventRecord, EventType } from '@/types/calendar'
import type { ParsedCalendarEvent } from '@/lib/calendar/schema'
import { cn } from '@/lib/utils'
import { TeacherPicker } from './teacher-picker'
import { NlInput } from './nl-input'

type EventDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  initialDate?: Date | null
  initialEvent?: EventRecord | null
  canCreateSchool: boolean
  selfTeacherId: string
  onSaved: () => void
}

type FormState = {
  title: string
  description: string
  date: string // yyyy-MM-dd
  time: string // HH:mm
  endDate: string
  endTime: string
  allDay: boolean
  eventType: EventType
  color: EventColor
  shareWith: string[]
}

function toDatePart(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function toTimePart(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function combineToIso(date: string, time: string, allDay: boolean): string {
  if (!date) return ''
  if (allDay) {
    // KST 00:00으로 고정
    return `${date}T00:00:00+09:00`
  }
  return `${date}T${time || '09:00'}:00+09:00`
}

function emptyState(initialDate?: Date | null): FormState {
  const base = initialDate ?? new Date()
  return {
    title: '',
    description: '',
    date: toDatePart(base),
    time: toTimePart(base),
    endDate: '',
    endTime: '',
    allDay: true,
    eventType: 'personal',
    color: 'blue',
    shareWith: [],
  }
}

function eventToForm(ev: EventRecord): FormState {
  const start = new Date(ev.start_date)
  const end = ev.end_date ? new Date(ev.end_date) : null
  return {
    title: ev.title,
    description: ev.description ?? '',
    date: toDatePart(start),
    time: toTimePart(start),
    endDate: end ? toDatePart(end) : '',
    endTime: end ? toTimePart(end) : '',
    allDay: ev.all_day,
    eventType: (ev.event_type as EventType) ?? 'personal',
    color: normalizeColor(ev.color),
    shareWith: [],
  }
}

export function EventDialog({
  open,
  onOpenChange,
  mode,
  initialDate,
  initialEvent,
  canCreateSchool,
  selfTeacherId,
  onSaved,
}: EventDialogProps) {
  const [tab, setTab] = useState<'nl' | 'form'>(
    mode === 'edit' ? 'form' : 'nl'
  )
  const [state, setState] = useState<FormState>(() =>
    initialEvent ? eventToForm(initialEvent) : emptyState(initialDate)
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setTab(mode === 'edit' ? 'form' : 'nl')
    setState(
      initialEvent ? eventToForm(initialEvent) : emptyState(initialDate ?? null)
    )
  }, [open, mode, initialEvent, initialDate])

  const applyParsed = (parsed: ParsedCalendarEvent, autoShareIds: string[]) => {
    const start = new Date(parsed.start_date)
    const end = parsed.end_date ? new Date(parsed.end_date) : null
    setState((prev) => ({
      ...prev,
      title: parsed.title,
      description: parsed.description ?? '',
      date: toDatePart(start),
      time: toTimePart(start),
      endDate: end ? toDatePart(end) : '',
      endTime: end ? toTimePart(end) : '',
      allDay: parsed.all_day,
      eventType:
        parsed.event_type === 'school' && !canCreateSchool
          ? 'shared'
          : parsed.event_type,
      color: parsed.suggested_color as EventColor,
      shareWith: autoShareIds,
    }))
    setTab('form')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!state.title.trim()) {
      setError('제목은 필수입니다.')
      return
    }
    if (!state.date) {
      setError('시작 일자를 입력하세요.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const payload = {
        title: state.title.trim(),
        description: state.description.trim() || null,
        start_date: combineToIso(state.date, state.time, state.allDay),
        end_date:
          state.endDate && (state.allDay || state.endTime)
            ? combineToIso(state.endDate, state.endTime, state.allDay)
            : null,
        all_day: state.allDay,
        color: state.color,
        event_type: state.eventType,
        share_with:
          state.eventType === 'shared' ? state.shareWith : [],
      }

      const url =
        mode === 'edit' && initialEvent
          ? `/api/calendar/events/${initialEvent.id}`
          : '/api/calendar/events'
      const method = mode === 'edit' ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.message || json.error || '저장 실패')
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!initialEvent) return
    if (!confirm('이 일정을 삭제할까요? 되돌릴 수 없습니다.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/calendar/events/${initialEvent.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.message || json.error || '삭제 실패')
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="text-lg">
            {mode === 'edit' ? '일정 편집' : '새 일정'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {mode === 'edit'
              ? '내용을 수정한 뒤 저장하세요.'
              : '자연어로 한 줄 쓰거나, 상세 입력으로 바로 채울 수 있어요.'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          {mode === 'create' && (
            <div className="flex gap-1 rounded-lg bg-[#F7F6F3] p-1">
              <button
                type="button"
                onClick={() => setTab('nl')}
                className={cn(
                  'flex-1 inline-flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition',
                  tab === 'nl'
                    ? 'bg-white text-[#1E293B] shadow-sm'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                자연어
              </button>
              <button
                type="button"
                onClick={() => setTab('form')}
                className={cn(
                  'flex-1 rounded-md py-2 text-sm font-medium transition',
                  tab === 'form'
                    ? 'bg-white text-[#1E293B] shadow-sm'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                )}
              >
                상세 입력
              </button>
            </div>
          )}

          {tab === 'nl' && mode === 'create' && (
            <NlInput onApply={applyParsed} />
          )}

          {tab === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 기본 정보 */}
              <section className="space-y-4">
                <SectionLabel>기본 정보</SectionLabel>
                <div className="space-y-1.5">
                  <Label htmlFor="title">제목</Label>
                  <Input
                    id="title"
                    value={state.title}
                    onChange={(e) =>
                      setState((s) => ({ ...s, title: e.target.value }))
                    }
                    placeholder="예: 1학년 3반 수업"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">설명 (선택)</Label>
                  <Textarea
                    id="description"
                    rows={2}
                    value={state.description}
                    onChange={(e) =>
                      setState((s) => ({ ...s, description: e.target.value }))
                    }
                    placeholder="준비 사항, 참고 자료 링크 등"
                  />
                </div>
              </section>

              {/* 일시 */}
              <section className="space-y-4 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <SectionLabel className="mb-0">일시</SectionLabel>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="allDay"
                      className="text-xs text-[#64748B] cursor-pointer"
                    >
                      종일
                    </Label>
                    <Switch
                      id="allDay"
                      checked={state.allDay}
                      onCheckedChange={(checked) =>
                        setState((s) => ({ ...s, allDay: checked }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">시작 일자</Label>
                    <Input
                      type="date"
                      value={state.date}
                      onChange={(e) =>
                        setState((s) => ({ ...s, date: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      시작 시각 {state.allDay && '(종일 일정)'}
                    </Label>
                    <Input
                      type="time"
                      value={state.time}
                      disabled={state.allDay}
                      onChange={(e) =>
                        setState((s) => ({ ...s, time: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#64748B]">
                      종료 일자 (선택)
                    </Label>
                    <Input
                      type="date"
                      value={state.endDate}
                      onChange={(e) =>
                        setState((s) => ({ ...s, endDate: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-[#64748B]">
                      종료 시각 (선택)
                    </Label>
                    <Input
                      type="time"
                      value={state.endTime}
                      disabled={state.allDay}
                      onChange={(e) =>
                        setState((s) => ({ ...s, endTime: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </section>

              {/* 분류 */}
              <section className="space-y-4 pt-2 border-t border-slate-100">
                <SectionLabel>분류</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">종류</Label>
                    <Select
                      value={state.eventType}
                      onValueChange={(v) =>
                        setState((s) => ({ ...s, eventType: v as EventType }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">개인</SelectItem>
                        <SelectItem value="shared">공유 (특정 교사)</SelectItem>
                        {canCreateSchool && (
                          <SelectItem value="school">학교 전체</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">색상</Label>
                    <Select
                      value={state.color}
                      onValueChange={(v) =>
                        setState((s) => ({ ...s, color: v as EventColor }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(EVENT_COLOR_STYLES).map(
                          ([key, cfg]) => (
                            <SelectItem key={key} value={key}>
                              <span className="inline-flex items-center gap-2">
                                <span
                                  className={cn(
                                    'h-2.5 w-2.5 rounded-full',
                                    cfg.dot
                                  )}
                                />
                                {cfg.label}
                              </span>
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* 공유 대상 */}
              {state.eventType === 'shared' && (
                <section className="space-y-2 pt-2 border-t border-slate-100">
                  <SectionLabel>공유 대상 교사</SectionLabel>
                  <TeacherPicker
                    selectedIds={state.shareWith}
                    onChange={(ids) =>
                      setState((s) => ({ ...s, shareWith: ids }))
                    }
                    excludeId={selfTeacherId}
                  />
                </section>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <DialogFooter className="gap-2 sm:gap-2 pt-4 border-t border-slate-100">
                {mode === 'edit' && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleDelete}
                    disabled={deleting || saving}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 mr-auto"
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-1" />
                        삭제
                      </>
                    )}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[#3B82F6] hover:bg-[#2563EB]"
                >
                  {saving && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  )}
                  저장
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        'text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-3',
        className
      )}
    >
      {children}
    </p>
  )
}
