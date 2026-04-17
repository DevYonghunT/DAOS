'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EVENT_COLOR_STYLES, normalizeColor } from '@/lib/calendar/colors'
import type { EventRecord } from '@/types/calendar'
import { cn } from '@/lib/utils'

const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function DashboardCalendar() {
  const [month, setMonth] = useState<Date>(new Date())
  const [events, setEvents] = useState<EventRecord[]>([])

  const loadEvents = useCallback(async (target: Date) => {
    const from = startOfMonth(target).toISOString()
    const to = endOfMonth(target).toISOString()
    try {
      const res = await fetch(
        `/api/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      )
      if (!res.ok) return
      const json = await res.json()
      setEvents(json.events ?? [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadEvents(month)
  }, [month, loadEvents])

  const today = new Date()
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start, end })

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventRecord[]>()
    for (const ev of events) {
      const key = format(new Date(ev.start_date), 'yyyy-MM-dd')
      const arr = map.get(key) ?? []
      arr.push(ev)
      map.set(key, arr)
    }
    return map
  }, [events])

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setMonth(subMonths(month, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-[#1E293B] min-w-[130px] text-center">
            {format(month, 'yyyy년 M월')}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="ml-2" onClick={() => setMonth(new Date())}>
            오늘
          </Button>
        </div>
        <Link
          href="/office/calendar"
          className="text-xs text-[#3B82F6] hover:underline"
        >
          캘린더 전체 보기 →
        </Link>
      </div>

      {/* 요일 */}
      <div className="grid grid-cols-7 border-b border-slate-100 bg-[#F7F6F3]">
        {WEEK_LABELS.map((label, i) => (
          <div
            key={label}
            className={cn(
              'px-3 py-2 text-xs font-medium text-center',
              i === 0 && 'text-red-500',
              i === 6 && 'text-blue-500',
              i !== 0 && i !== 6 && 'text-[#64748B]'
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 — 남은 공간 전부 사용 */}
      <div className="grid grid-cols-7 flex-1">
        {days.map((day) => {
          const isCurrent = isSameMonth(day, month)
          const isToday = isSameDay(day, today)
          const dayKey = format(day, 'yyyy-MM-dd')
          const dayEvents = eventsByDay.get(dayKey) ?? []
          const dow = day.getDay()

          return (
            <Link
              key={dayKey}
              href={`/office/calendar?m=${format(month, 'yyyy-MM')}`}
              className={cn(
                'border-r border-b border-slate-100 last:border-r-0 p-1.5 hover:bg-[#F7F6F3]/60 transition-colors',
                !isCurrent && 'bg-slate-50/50'
              )}
            >
              <div
                className={cn(
                  'inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs mb-1 px-1',
                  isToday && 'bg-[#3B82F6] text-white font-bold',
                  !isToday && dow === 0 && 'text-red-500',
                  !isToday && dow === 6 && 'text-blue-500',
                  !isToday && dow !== 0 && dow !== 6 && 'text-[#1E293B]',
                  !isCurrent && !isToday && 'opacity-40'
                )}
              >
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => {
                  const style = EVENT_COLOR_STYLES[normalizeColor(ev.color)]
                  return (
                    <div
                      key={ev.id}
                      className={cn(
                        'truncate rounded border px-1 py-0.5 text-[10px] leading-tight',
                        style.pill
                      )}
                    >
                      {ev.title}
                    </div>
                  )
                })}
                {dayEvents.length > 3 && (
                  <p className="text-[9px] text-[#94A3B8] px-1">
                    +{dayEvents.length - 3}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
