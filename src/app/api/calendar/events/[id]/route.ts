import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EventUpsertSchema } from '@/lib/calendar/schema'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** PATCH /api/calendar/events/:id — 일정 수정 (작성자만) */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
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

  const parsed = EventUpsertSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const input = parsed.data

  if (input.event_type === 'school' && !isAdmin(teacher)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.title !== undefined) updatePayload.title = input.title
  if (input.description !== undefined)
    updatePayload.description = input.description
  if (input.start_date !== undefined)
    updatePayload.start_date = input.start_date
  if (input.end_date !== undefined) updatePayload.end_date = input.end_date
  if (input.all_day !== undefined) updatePayload.all_day = input.all_day
  if (input.color !== undefined) updatePayload.color = input.color
  if (input.event_type !== undefined)
    updatePayload.event_type = input.event_type

  const { data: event, error } = await supabase
    .from('events')
    .update(updatePayload)
    .eq('id', id)
    .eq('created_by', teacher.id) // RLS도 막지만 명시적으로
    .select()
    .single()

  if (error || !event) {
    return NextResponse.json(
      { error: 'update_failed', message: error?.message },
      { status: 500 }
    )
  }

  // share_with이 같이 오면 공유 리셋
  if (input.share_with !== undefined) {
    await supabase.from('event_shares').delete().eq('event_id', id)
    if (input.share_with.length > 0) {
      const rows = input.share_with.map((tid) => ({
        event_id: id,
        shared_with: tid,
      }))
      await supabase.from('event_shares').insert(rows)
    }
  }

  return NextResponse.json({ event })
}

/** DELETE /api/calendar/events/:id — 일정 삭제 (작성자만) */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)
    .eq('created_by', teacher.id)

  if (error) {
    return NextResponse.json(
      { error: 'delete_failed', message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
