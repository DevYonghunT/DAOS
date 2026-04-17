'use client'

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { EVENT_COLOR_STYLES, normalizeColor } from '@/lib/calendar/colors'
import type { EventRecord } from '@/types/calendar'
import { cn } from '@/lib/utils'

type MonthGridProps = {
  month: Date
  events: EventRecord[]
  onDayClick: (day: Date) => void
  onEventClick: (event: EventRecord) => void
  selectedDay?: Date | null
}

const WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export function MonthGrid({
  month,
  events,
  onDayClick,
  onEventClick,
  selectedDay,
}: MonthGridProps) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start, end })
  const today = new Date()

  const eventsByDay = groupEventsByDay(events)

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-[#F7F6F3]">
        {WEEK_LABELS.map((label, i) => (
          <div
            key={label}
            className={cn(
              'px-3 py-2 text-xs font-medium',
              i === 0 && 'text-red-500',
              i === 6 && 'text-blue-500',
              i !== 0 && i !== 6 && 'text-[#64748B]'
            )}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 날짜 셀들 */}
      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((day, idx) => {
          const isCurrent = isSameMonth(day, month)
          const isToday = isSameDay(day, today)
          const isSelected = selectedDay && isSameDay(day, selectedDay)
          const dayKey = format(day, 'yyyy-MM-dd')
          const dayEvents = eventsByDay.get(dayKey) ?? []
          const dow = day.getDay()

          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => onDayClick(day)}
              className={cn(
                'group text-left border-r border-b border-slate-100 last:border-r-0 p-1.5 min-h-[110px] hover:bg-[#F7F6F3]/60 transition-colors',
                idx % 7 === 6 && 'border-r-0',
                !isCurrent && 'bg-slate-50/50 text-slate-400',
                isSelected && 'bg-[#EEF4FF]/40'
              )}
            >
              <div
                className={cn(
                  'inline-flex h-6 min-w-6 items-center justify-center rounded-full text-xs mb-1 px-1.5',
                  isToday && 'bg-[#3B82F6] text-white font-semibold',
                  !isToday && dow === 0 && 'text-red-500',
                  !isToday && dow === 6 && 'text-blue-500',
                  !isToday && dow !== 0 && dow !== 6 && 'text-[#1E293B]'
                )}
              >
                {format(day, 'd')}
              </div>

              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((ev) => {
                  const style = EVENT_COLOR_STYLES[normalizeColor(ev.color)]
                  return (
                    <div
                      key={ev.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick(ev)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          onEventClick(ev)
                        }
                      }}
                      className={cn(
                        'truncate rounded-md border px-1.5 py-0.5 text-[11px] leading-tight',
                        style.pill,
                        'hover:brightness-95 transition'
                      )}
                      title={ev.title}
                    >
                      {!ev.all_day && (
                        <span className="opacity-70 mr-1">
                          {format(new Date(ev.start_date), 'HH:mm')}
                        </span>
                      )}
                      {ev.title}
                    </div>
                  )
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-[#64748B] px-1">
                    +{dayEvents.length - 3}개 더
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function groupEventsByDay(events: EventRecord[]): Map<string, EventRecord[]> {
  const map = new Map<string, EventRecord[]>()
  for (const ev of events) {
    const key = format(new Date(ev.start_date), 'yyyy-MM-dd')
    const arr = map.get(key) ?? []
    arr.push(ev)
    map.set(key, arr)
  }
  // 각 날짜 내부 시간순 정렬
  for (const arr of map.values()) {
    arr.sort(
      (a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    )
  }
  return map
}
