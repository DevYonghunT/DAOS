import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'
import { ProgramUpsertSchema } from '@/lib/activity/schema'
import { findCategory } from '@/lib/activity/categories'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** GET /api/activity/programs/:id — 상세 + 참가자 목록 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: program, error } = await supabase
    .from('programs')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error || !program) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { data: parts } = await supabase
    .from('program_participants')
    .select('id, student_id, participant_order, checked_in, checked_in_at, created_at')
    .eq('program_id', id)
    .order('created_at', { ascending: true })

  const studentIds = (parts ?? []).map((p) => p.student_id)
  let students: Record<string, unknown>[] = []
  if (studentIds.length > 0) {
    const { data: profs } = await supabase
      .from('student_profiles')
      .select('id, student_number, name')
      .in('id', studentIds)
    const { data: enrolls } = await supabase
      .from('student_enrollments')
      .select('student_id, academic_year, grade, class_number, number_in_class')
      .in('student_id', studentIds)
      .eq('academic_year', program.academic_year)

    const enrollMap = new Map(
      (enrolls ?? []).map((e) => [e.student_id, e])
    )
    students = (profs ?? []).map((p) => {
      const e = enrollMap.get(p.id) as { grade?: number; class_number?: number; number_in_class?: number; academic_year?: number } | undefined
      return {
        id: p.id,
        student_number: p.student_number,
        name: p.name,
        grade: e?.grade ?? null,
        class_number: e?.class_number ?? null,
        number_in_class: e?.number_in_class ?? null,
        academic_year: e?.academic_year ?? null,
      }
    })
  }

  const studentMap = new Map(students.map((s) => [s.id, s]))
  const participants = (parts ?? []).map((p) => ({
    ...p,
    student: studentMap.get(p.student_id) ?? null,
  }))

  // 담당 교사 이름
  let teacher_name: string | null = null
  if (program.teacher_id) {
    const { data: t } = await supabase
      .from('teachers')
      .select('name')
      .eq('id', program.teacher_id)
      .maybeSingle()
    teacher_name = t?.name ?? null
  }

  return NextResponse.json({
    program: { ...program, teacher_name },
    participants,
  })
}

/** PATCH /api/activity/programs/:id */
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
  const parsed = ProgramUpsertSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  // 담당자 또는 관리자만 수정 (RLS가 강제하지만 명시적으로도)
  const { data: existing } = await supabase
    .from('programs')
    .select('teacher_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (existing.teacher_id !== teacher.id && !isAdmin(teacher)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  for (const [key, value] of Object.entries(parsed.data)) {
    if (key === 'byte_limit') continue // 서버가 카테고리 기준으로 설정
    if (value !== undefined) update[key] = value
  }
  // 카테고리 변경 시 byte_limit 재설정
  if (parsed.data.record_category) {
    const cat = findCategory(parsed.data.record_category)
    if (!cat) {
      return NextResponse.json({ error: 'invalid_category' }, { status: 400 })
    }
    update.byte_limit = cat.limitBytes
  }

  const { data: program, error } = await supabase
    .from('programs')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error || !program) {
    return NextResponse.json(
      { error: 'update_failed', message: error?.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ program })
}

/** DELETE /api/activity/programs/:id */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: existing } = await supabase
    .from('programs')
    .select('teacher_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (existing.teacher_id !== teacher.id && !isAdmin(teacher)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('programs').delete().eq('id', id)
  if (error) {
    return NextResponse.json(
      { error: 'delete_failed', message: error.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true })
}
