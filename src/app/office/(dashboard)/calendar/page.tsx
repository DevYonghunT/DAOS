import { redirect } from 'next/navigation'
import { endOfMonth, startOfMonth } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'
import { CalendarClient } from './calendar-client'
import type { EventRecord } from '@/types/calendar'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ m?: string }>
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const { m } = await searchParams

  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) redirect('/office/login')

  const month = parseMonth(m)
  const from = startOfMonth(month).toISOString()
  const to = endOfMonth(month).toISOString()

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .gte('start_date', from)
    .lte('start_date', to)
    .order('start_date', { ascending: true })

  return (
    <CalendarClient
      initialMonthISO={formatMonthParam(month)}
      initialEvents={(events ?? []) as EventRecord[]}
      canCreateSchool={isAdmin(teacher)}
      selfTeacherId={teacher.id}
    />
  )
}

function parseMonth(value: string | undefined): Date {
  if (!value) return new Date()
  const [y, m] = value.split('-').map((n) => parseInt(n, 10))
  if (!isFinite(y) || !isFinite(m)) return new Date()
  return new Date(y, m - 1, 1)
}

function formatMonthParam(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}
