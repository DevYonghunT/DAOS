import Link from 'next/link'
import { addDays, format, isToday, startOfDay } from 'date-fns'
import { Calendar as CalendarIcon, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EVENT_COLOR_STYLES, normalizeColor } from '@/lib/calendar/colors'
import { cn } from '@/lib/utils'
import type { EventRecord } from '@/types/calendar'

/**
 * 홈 대시보드용 미니 위젯: 오늘 + 향후 7일 일정 중 상위 6개 표시
 * RLS 덕분에 본인 것 + 공유 + 학교 이벤트만 반환됨
 */
export async function CalendarMiniWidget() {
  const supabase = await createClient()
  const now = startOfDay(new Date())
  const horizon = addDays(now, 7)

  const { data } = await supabase
    .from('events')
    .select('*')
    .gte('start_date', now.toISOString())
    .lte('start_date', horizon.toISOString())
    .order('start_date', { ascending: true })
    .limit(6)

  const events = (data ?? []) as EventRecord[]

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E293B]">
          <CalendarIcon className="h-4 w-4 text-[#3B82F6]" />
          다가오는 일정
        </h2>
        <Link
          href="/office/calendar"
          className="inline-flex items-center gap-1 text-xs text-[#3B82F6] hover:underline"
        >
          전체 보기
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-[#64748B]">다가오는 일정이 없어요.</p>
          <Link
            href="/office/calendar"
            className="inline-block mt-2 text-xs text-[#3B82F6] hover:underline"
          >
            일정 추가하기 →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => {
            const d = new Date(ev.start_date)
            const style = EVENT_COLOR_STYLES[normalizeColor(ev.color)]
            return (
              <li key={ev.id}>
                <Link
                  href="/office/calendar"
                  className="flex items-start gap-3 rounded-lg px-2.5 py-2 hover:bg-[#F7F6F3]"
                >
                  <div className="flex flex-col items-center justify-center rounded-md px-2 py-1 min-w-[44px] shrink-0 bg-[#F7F6F3]">
                    <span className="text-[10px] uppercase tracking-wide text-[#64748B]">
                      {format(d, 'MMM')}
                    </span>
                    <span
                      className={cn(
                        'text-sm font-bold',
                        isToday(d) ? 'text-[#3B82F6]' : 'text-[#1E293B]'
                      )}
                    >
                      {format(d, 'd')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', style.dot)} />
                      <p className="text-sm font-medium text-[#1E293B] truncate">
                        {ev.title}
                      </p>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {ev.all_day ? '종일' : format(d, 'a h:mm')} ·{' '}
                      {ev.event_type === 'school'
                        ? '학교'
                        : ev.event_type === 'shared'
                          ? '공유'
                          : '개인'}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
