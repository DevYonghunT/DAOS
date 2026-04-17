import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EventUpsertSchema } from '@/lib/calendar/schema'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'

export const runtime = 'nodejs'

/** GET /api/calendar/events?from=ISO&to=ISO — 범위 내 일정 + 공유받은 것 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')

  let query = supabase
    .from('events')
    .select('*')
    .order('start_date', { ascending: true })

  if (from) query = query.gte('start_date', from)
  if (to) query = query.lte('start_date', to)

  const { data: events, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ events: events ?? [] })
}

/** POST /api/calendar/events — 새 일정 생성 (+ 공유 대상 등록) */
export async function POST(req: Request) {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = EventUpsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const input = parsed.data

  // school 이벤트는 관리자만
  if (input.event_type === 'school' && !isAdmin(teacher)) {
    return NextResponse.json(
      { error: 'forbidden', message: '학교 전체 일정은 관리자만 생성할 수 있습니다.' },
      { status: 403 }
    )
  }

  const { data: event, error: evErr } = await supabase
    .from('events')
    .insert({
      title: input.title,
      description: input.description ?? null,
      start_date: input.start_date,
      end_date: input.end_date ?? null,
      all_day: input.all_day,
      color: input.color,
      event_type: input.event_type,
      created_by: teacher.id,
    })
    .select()
    .single()

  if (evErr || !event) {
    return NextResponse.json(
      { error: 'create_failed', message: evErr?.message },
      { status: 500 }
    )
  }

  // 공유 대상 등록
  const shareWith =
    input.event_type === 'shared' ? input.share_with ?? [] : []
  if (shareWith.length > 0) {
    const rows = shareWith.map((tid) => ({
      event_id: event.id,
      shared_with: tid,
    }))
    const { error: shErr } = await supabase.from('event_shares').insert(rows)
    if (shErr) {
      console.error('[api/calendar/events] 공유 insert 실패', shErr)
    }
  }

  return NextResponse.json({ event }, { status: 201 })
}
