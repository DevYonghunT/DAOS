import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserContext, isTeacher } from '@/lib/auth/context'
import { verifyRoomMember } from '@/lib/classroom/access'

export const runtime = 'nodejs'
type Params = { params: Promise<{ id: string }> }

/** GET /api/classroom/rooms/:id — 방 상세 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!(await verifyRoomMember(supabase, id, ctx))) {
    return NextResponse.json({ error: 'not_a_member' }, { status: 403 })
  }

  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ room })
}

/** PATCH /api/classroom/rooms/:id — 방 수정 (생성자만) */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx || !isTeacher(ctx)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const allowed = ['title', 'description', 'subject', 'grade', 'class_number']
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) {
    if (body[k] !== undefined) update[k] = body[k]
  }

  const { data, error } = await supabase
    .from('rooms')
    .update(update)
    .eq('id', id)
    .eq('created_by', ctx.profile.id)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'update_failed' }, { status: 500 })
  return NextResponse.json({ room: data })
}

/** DELETE /api/classroom/rooms/:id — 방 비활성화 */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx || !isTeacher(ctx)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('rooms')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('created_by', ctx.profile.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
