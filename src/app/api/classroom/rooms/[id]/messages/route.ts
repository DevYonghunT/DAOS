import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserContext, isTeacher, isStudent } from '@/lib/auth/context'
import { verifyRoomMember } from '@/lib/classroom/access'

export const runtime = 'nodejs'
type Params = { params: Promise<{ id: string }> }

/** GET /api/classroom/rooms/:id/messages?cursor=ISO&limit=50 */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyRoomMember(supabase, id, ctx))) {
    return NextResponse.json({ error: 'not_a_member' }, { status: 403 })
  }

  const url = new URL(req.url)
  const cursor = url.searchParams.get('cursor')
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)

  let query = supabase
    .from('room_messages')
    .select('id, room_id, sender_type, teacher_id, student_id, content, mentions_ai, created_at')
    .eq('room_id', id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt('created_at', cursor)

  const { data: messages, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 발신자 이름 조인
  const tIds = new Set<string>()
  const sIds = new Set<string>()
  for (const m of messages ?? []) {
    if (m.teacher_id) tIds.add(m.teacher_id)
    if (m.student_id) sIds.add(m.student_id)
  }

  const nameMap = new Map<string, string>()
  if (tIds.size > 0) {
    const { data } = await supabase.from('teachers').select('id, name').in('id', [...tIds])
    for (const t of data ?? []) nameMap.set(t.id, t.name)
  }
  if (sIds.size > 0) {
    const { data } = await supabase.from('student_profiles').select('id, name').in('id', [...sIds])
    for (const s of data ?? []) nameMap.set(s.id, s.name)
  }

  const enriched = (messages ?? []).reverse().map((m) => ({
    ...m,
    sender_name:
      m.sender_type === 'system'
        ? '시스템'
        : m.sender_type === 'ai'
          ? 'AI'
          : nameMap.get(m.teacher_id ?? m.student_id ?? '') ?? '알 수 없음',
  }))

  return NextResponse.json({
    messages: enriched,
    has_more: (messages ?? []).length === limit,
  })
}

/** POST /api/classroom/rooms/:id/messages — 메시지 전송 */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyRoomMember(supabase, id, ctx))) {
    return NextResponse.json({ error: 'not_a_member' }, { status: 403 })
  }

  let body: { content: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const content = body.content?.trim()
  if (!content) return NextResponse.json({ error: 'empty_content' }, { status: 400 })

  const senderType = isTeacher(ctx) ? 'teacher' : isStudent(ctx) ? 'student' : null
  if (!senderType) return NextResponse.json({ error: 'unknown_user_type' }, { status: 403 })

  const mentionsAi = /@(AI|ai|Claude|claude|에이아이)\b/.test(content)

  const row: Record<string, unknown> = {
    room_id: id,
    sender_type: senderType,
    content,
    mentions_ai: mentionsAi,
  }
  if (senderType === 'teacher') row.teacher_id = ctx.profile.id
  if (senderType === 'student') row.student_id = ctx.profile.id

  const { data: msg, error } = await supabase
    .from('room_messages')
    .insert(row)
    .select()
    .single()

  if (error || !msg) {
    return NextResponse.json({ error: error?.message ?? 'send_failed' }, { status: 500 })
  }

  // 방 updated_at 갱신
  await supabase.from('rooms').update({ updated_at: new Date().toISOString() }).eq('id', id)

  // @AI 멘션 → 백그라운드로 AI 응답 트리거 (non-blocking)
  if (mentionsAi) {
    const origin = new URL(req.url).origin
    fetch(`${origin}/api/classroom/rooms/${id}/ai-respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: req.headers.get('cookie') ?? '',
      },
    }).catch((err) => {
      console.error('[messages] AI 트리거 실패:', err)
    })
  }

  return NextResponse.json({ message: msg }, { status: 201 })
}
