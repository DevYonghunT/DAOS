import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserContext, isTeacher } from '@/lib/auth/context'

export const runtime = 'nodejs'

/** GET /api/classroom/rooms — 내가 속한 방 목록 */
export async function GET() {
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('id, title, description, subject, grade, class_number, academic_year, is_active, created_by, created_at, updated_at')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 각 방의 마지막 메시지
  const roomIds = (rooms ?? []).map((r) => r.id)
  const lastMsgMap = new Map<string, { content: string; created_at: string; sender_type: string }>()
  if (roomIds.length > 0) {
    for (const rid of roomIds) {
      const { data: lastMsg } = await supabase
        .from('room_messages')
        .select('content, created_at, sender_type')
        .eq('room_id', rid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (lastMsg) lastMsgMap.set(rid, lastMsg)
    }
  }

  // 멤버 수
  const memberCountMap = new Map<string, number>()
  if (roomIds.length > 0) {
    const { data: members } = await supabase
      .from('room_members')
      .select('room_id')
      .in('room_id', roomIds)
      .eq('is_active', true)
    for (const m of members ?? []) {
      memberCountMap.set(m.room_id, (memberCountMap.get(m.room_id) ?? 0) + 1)
    }
  }

  const enriched = (rooms ?? []).map((r) => ({
    ...r,
    last_message: lastMsgMap.get(r.id) ?? null,
    member_count: memberCountMap.get(r.id) ?? 0,
  }))

  return NextResponse.json({ rooms: enriched })
}

/** POST /api/classroom/rooms — 새 방 생성 (교사만) */
export async function POST(req: Request) {
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx || !isTeacher(ctx)) {
    return NextResponse.json({ error: 'teachers_only' }, { status: 403 })
  }

  let body: {
    title: string
    description?: string
    subject?: string
    grade?: number
    class_number?: number
    persona_prompt?: string
    ai_model?: string
    student_ids?: string[]
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'title_required' }, { status: 400 })
  }

  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .insert({
      created_by: ctx.profile.id,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      subject: body.subject?.trim() || null,
      grade: body.grade ?? null,
      class_number: body.class_number ?? null,
      persona_prompt: body.persona_prompt?.trim() || null,
      ai_model: body.ai_model || 'claude-haiku-4-5',
    })
    .select()
    .single()

  if (roomErr || !room) {
    return NextResponse.json({ error: roomErr?.message ?? 'create_failed' }, { status: 500 })
  }

  // 생성 교사를 멤버로 추가
  await supabase.from('room_members').insert({
    room_id: room.id,
    member_type: 'teacher',
    teacher_id: ctx.profile.id,
  })

  // 시스템 메시지
  await supabase.from('room_messages').insert({
    room_id: room.id,
    sender_type: 'system',
    content: `${ctx.profile.name} 선생님이 방을 만들었습니다.`,
  })

  // 학생 초대
  if (body.student_ids && body.student_ids.length > 0) {
    const memberRows = body.student_ids.map((sid) => ({
      room_id: room.id,
      member_type: 'student' as const,
      student_id: sid,
    }))
    await supabase.from('room_members').insert(memberRows)

    // 학생 이름 조회
    const { data: students } = await supabase
      .from('student_profiles')
      .select('name')
      .in('id', body.student_ids)
    const names = (students ?? []).map((s) => s.name).join(', ')
    if (names) {
      await supabase.from('room_messages').insert({
        room_id: room.id,
        sender_type: 'system',
        content: `${names} 학생이 초대되었습니다.`,
      })
    }
  }

  return NextResponse.json({ room }, { status: 201 })
}
