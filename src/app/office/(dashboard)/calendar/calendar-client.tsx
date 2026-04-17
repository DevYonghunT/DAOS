'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MonthGrid } from '@/components/calendar/month-grid'
import { EventDialog } from '@/components/calendar/event-dialog'
import { EVENT_COLOR_STYLES, normalizeColor } from '@/lib/calendar/colors'
import type { EventRecord } from '@/types/calendar'
import { cn } from '@/lib/utils'

type Props = {
  initialMonthISO: string // yyyy-MM
  initialEvents: EventRecord[]
  canCreateSchool: boolean
  selfTeacherId: string
}

export function CalendarClient({
  initialMonthISO,
  initialEvents,
  canCreateSchool,
  selfTeacherId,
}: Props) {
  const router = useRouter()
  const [month, setMonth] = useState<Date>(() => parseMonth(initialMonthISO))
  const [events, setEvents] = useState<EventRecord[]>(initialEvents)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null)

  // 월 변경 시 해당 월 이벤트 로드
  const loadMonth = useCallback(async (target: Date) => {
    const from = startOfMonth(target).toISOString()
    const to = endOfMonth(target).toISOString()
    const res = await fetch(
      `/api/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    )
    if (!res.ok) return
    const json = (await res.json()) as { events: EventRecord[] }
    setEvents(json.events)
  }, [])

  useEffect(() => {
    // URL 동기화 (뒤로가기 지원)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('m', format(month, 'yyyy-MM'))
    window.history.replaceState(null, '', url.toString())
  }, [month])

  const todayEvents = useMemo(() => {
    const target = selectedDay ?? new Date()
    return events
      .filter((e) => isSameDay(new Date(e.start_date), target))
      .sort(
        (a, b) =>
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      )
  }, [events, selectedDay])

  const handlePrev = () => {
    const next = subMonths(month, 1)
    setMonth(next)
    loadMonth(next)
  }
  const handleNext = () => {
    const next = addMonths(month, 1)
    setMonth(next)
    loadMonth(next)
  }
  const handleToday = () => {
    const next = new Date()
    setMonth(next)
    setSelectedDay(next)
    loadMonth(next)
  }

  const openCreate = (day?: Date) => {
    setEditingEvent(null)
    if (day) setSelectedDay(day)
    setDialogOpen(true)
  }

  const openEdit = (ev: EventRecord) => {
    setEditingEvent(ev)
    setDialogOpen(true)
  }

  const onSaved = () => {
    loadMonth(month)
    router.refresh()
  }

  const monthLabel = format(month, 'yyyy년 M월')

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrev}
            aria-label="이전 달"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold text-[#1E293B] min-w-[120px] text-center">
            {monthLabel}
          </h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            aria-label="다음 달"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="ml-2"
          >
            오늘
          </Button>
        </div>
        <Button
          onClick={() => openCreate(selectedDay ?? undefined)}
          className="bg-[#3B82F6] hover:bg-[#2563EB]"
        >
          <Plus className="h-4 w-4 mr-1" />새 일정
        </Button>
      </header>

      {/* 본문 */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#F7F6F3]">
        <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <MonthGrid
            month={month}
            events={events}
            onDayClick={(d) => setSelectedDay(d)}
            onEventClick={openEdit}
            selectedDay={selectedDay}
          />

          {/* 선택 날짜 사이드 패널 */}
          <aside className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 h-fit lg:sticky lg:top-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[#1E293B]">
                {selectedDay
                  ? format(selectedDay, 'M월 d일 (EEE)')
                  : '오늘 일정'}
              </h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openCreate(selectedDay ?? undefined)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            {todayEvents.length === 0 ? (
              <p className="text-xs text-[#64748B] py-4 text-center">
                등록된 일정이 없어요.
              </p>
            ) : (
              <ul className="space-y-2">
                {todayEvents.map((ev) => {
                  const style =
                    EVENT_COLOR_STYLES[normalizeColor(ev.color)]
                  return (
                    <li key={ev.id}>
                      <button
                        type="button"
                        onClick={() => openEdit(ev)}
                        className="w-full text-left rounded-lg border border-slate-200 hover:border-[#3B82F6]/40 px-3 py-2 bg-white transition"
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={cn(
                              'mt-1 h-2 w-2 rounded-full shrink-0',
                              style.dot
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1E293B] truncate">
                              {ev.title}
                            </p>
                            <p className="text-[11px] text-[#64748B] mt-0.5">
                              {ev.all_day
                                ? '종일'
                                : format(new Date(ev.start_date), 'HH:mm')}
                              {' · '}
                              {ev.event_type === 'school'
                                ? '학교'
                                : ev.event_type === 'shared'
                                  ? '공유'
                                  : '개인'}
                            </p>
                            {ev.description && (
                              <p className="text-xs text-[#475569] mt-1 line-clamp-2">
                                {ev.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </aside>
        </div>
      </div>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={editingEvent ? 'edit' : 'create'}
        initialDate={selectedDay}
        initialEvent={editingEvent}
        canCreateSchool={canCreateSchool}
        selfTeacherId={selfTeacherId}
        onSaved={onSaved}
      />
    </div>
  )
}

function parseMonth(value: string): Date {
  const [y, m] = value.split('-').map((n) => parseInt(n, 10))
  if (!isFinite(y) || !isFinite(m)) return new Date()
  return new Date(y, m - 1, 1)
}
