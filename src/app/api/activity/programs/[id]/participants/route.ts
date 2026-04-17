import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'
import { AddParticipantsSchema } from '@/lib/activity/schema'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** POST /api/activity/programs/:id/participants — 학생 여러 명 추가 */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: program } = await supabase
    .from('programs')
    .select('id, teacher_id')
    .eq('id', id)
    .maybeSingle()
  if (!program) {
    return NextResponse.json({ error: 'program_not_found' }, { status: 404 })
  }
  if (program.teacher_id !== teacher.id && !isAdmin(teacher)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const parsed = AddParticipantsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  // 기존 참가자 조회 (중복 방지)
  const { data: existing } = await supabase
    .from('program_participants')
    .select('student_id')
    .eq('program_id', id)
  const existingIds = new Set((existing ?? []).map((r) => r.student_id))

  const newIds = parsed.data.student_ids.filter((sid) => !existingIds.has(sid))
  if (newIds.length === 0) {
    return NextResponse.json({ ok: true, added: 0, skipped: parsed.data.student_ids.length })
  }

  // 다음 order 번호 계산
  const { count } = await supabase
    .from('program_participants')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', id)
  const base = count ?? 0

  const rows = newIds.map((sid, idx) => ({
    program_id: id,
    student_id: sid,
    participant_order: base + idx + 1,
  }))

  const { error: insErr } = await supabase.from('program_participants').insert(rows)
  if (insErr) {
    return NextResponse.json(
      { error: 'insert_failed', message: insErr.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    added: newIds.length,
    skipped: parsed.data.student_ids.length - newIds.length,
  })
}

/** DELETE /api/activity/programs/:id/participants?student_id=... — 참가자 1명 제거 */
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const studentId = url.searchParams.get('student_id')
  if (!studentId) {
    return NextResponse.json({ error: 'missing_student_id' }, { status: 400 })
  }

  const { data: program } = await supabase
    .from('programs')
    .select('teacher_id')
    .eq('id', id)
    .maybeSingle()
  if (!program) {
    return NextResponse.json({ error: 'program_not_found' }, { status: 404 })
  }
  if (program.teacher_id !== teacher.id && !isAdmin(teacher)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('program_participants')
    .delete()
    .eq('program_id', id)
    .eq('student_id', studentId)

  if (error) {
    return NextResponse.json(
      { error: 'delete_failed', message: error.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}
