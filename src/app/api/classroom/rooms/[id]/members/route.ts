import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserContext, isTeacher } from '@/lib/auth/context'

export const runtime = 'nodejs'
type Params = { params: Promise<{ id: string }> }

/** GET /api/classroom/rooms/:id/members */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: members } = await supabase
    .from('room_members')
    .select('id, member_type, teacher_id, student_id, is_active, joined_at')
    .eq('room_id', id)
    .eq('is_active', true)

  // 이름 조인
  const teacherIds = (members ?? []).filter((m) => m.teacher_id).map((m) => m.teacher_id!)
  const studentIds = (members ?? []).filter((m) => m.student_id).map((m) => m.student_id!)

  const teacherMap = new Map<string, string>()
  const studentMap = new Map<string, { name: string; student_number: string }>()

  if (teacherIds.length > 0) {
    const { data } = await supabase.from('teachers').select('id, name').in('id', teacherIds)
    for (const t of data ?? []) teacherMap.set(t.id, t.name)
  }
  if (studentIds.length > 0) {
    const { data } = await supabase.from('student_profiles').select('id, name, student_number').in('id', studentIds)
    for (const s of data ?? []) studentMap.set(s.id, { name: s.name, student_number: s.student_number })
  }

  const enriched = (members ?? []).map((m) => ({
    ...m,
    name: m.teacher_id
      ? teacherMap.get(m.teacher_id) ?? '교사'
      : studentMap.get(m.student_id!)?.name ?? '학생',
    student_number: m.student_id ? studentMap.get(m.student_id)?.student_number ?? '' : null,
  }))

  return NextResponse.json({ members: enriched })
}

/** POST /api/classroom/rooms/:id/members — 학생 초대 (교사만) */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx || !isTeacher(ctx)) {
    return NextResponse.json({ error: 'teachers_only' }, { status: 403 })
  }

  let body: { student_ids: string[] }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  if (!body.student_ids?.length) {
    return NextResponse.json({ error: 'no_students' }, { status: 400 })
  }

  // 기존 멤버 제외
  const { data: existing } = await supabase
    .from('room_members')
    .select('student_id')
    .eq('room_id', id)
  const existingSet = new Set((existing ?? []).map((e) => e.student_id))
  const newIds = body.student_ids.filter((sid) => !existingSet.has(sid))

  if (newIds.length > 0) {
    const rows = newIds.map((sid) => ({
      room_id: id,
      member_type: 'student' as const,
      student_id: sid,
    }))
    await supabase.from('room_members').insert(rows)

    // 시스템 메시지
    const { data: students } = await supabase
      .from('student_profiles')
      .select('name')
      .in('id', newIds)
    const names = (students ?? []).map((s) => s.name).join(', ')
    if (names) {
      await supabase.from('room_messages').insert({
        room_id: id,
        sender_type: 'system',
        content: `${names} 학생이 초대되었습니다.`,
      })
    }
  }

  return NextResponse.json({ added: newIds.length, skipped: body.student_ids.length - newIds.length })
}

/** DELETE /api/classroom/rooms/:id/members?student_id=... */
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx || !isTeacher(ctx)) {
    return NextResponse.json({ error: 'teachers_only' }, { status: 403 })
  }

  const studentId = new URL(req.url).searchParams.get('student_id')
  if (!studentId) return NextResponse.json({ error: 'missing_student_id' }, { status: 400 })

  // 학생 이름 조회 for 시스템 메시지
  const { data: student } = await supabase
    .from('student_profiles')
    .select('name')
    .eq('id', studentId)
    .maybeSingle()

  await supabase
    .from('room_members')
    .delete()
    .eq('room_id', id)
    .eq('student_id', studentId)

  if (student) {
    await supabase.from('room_messages').insert({
      room_id: id,
      sender_type: 'system',
      content: `${student.name} 학생이 나갔습니다.`,
    })
  }

  return NextResponse.json({ ok: true })
}
