import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'
import { ProgramUpsertSchema } from '@/lib/activity/schema'
import { findCategory } from '@/lib/activity/categories'

export const runtime = 'nodejs'

/** GET /api/activity/programs?year=2026&department=과학과&status=planned */
export async function GET(req: Request) {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const year = url.searchParams.get('year')
  const dept = url.searchParams.get('department')
  const status = url.searchParams.get('status')
  const q = url.searchParams.get('q')?.trim()

  let query = supabase
    .from('programs')
    .select(
      'id, academic_year, department, program_date, program_name, setuk_template, record_category, target_grade, byte_limit, teacher_id, status, created_at, updated_at'
    )
    .order('program_date', { ascending: false })

  if (year) query = query.eq('academic_year', Number(year))
  if (dept) query = query.eq('department', dept)
  if (status) query = query.eq('status', status)
  if (q) query = query.ilike('program_name', `%${q}%`)

  const { data: programs, error } = await query.limit(300)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const ids = (programs ?? []).map((p) => p.id)
  const { data: counts } = await supabase
    .from('program_participants')
    .select('program_id')
    .in('program_id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000'])

  const countMap = new Map<string, number>()
  for (const row of counts ?? []) {
    countMap.set(
      row.program_id,
      (countMap.get(row.program_id) ?? 0) + 1
    )
  }

  // 담당 교사 이름도 함께
  const teacherIds = Array.from(
    new Set((programs ?? []).map((p) => p.teacher_id).filter(Boolean))
  ) as string[]
  const teacherMap = new Map<string, string>()
  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id, name')
      .in('id', teacherIds)
    for (const t of teachers ?? []) {
      teacherMap.set(t.id, t.name)
    }
  }

  const enriched = (programs ?? []).map((p) => ({
    ...p,
    participant_count: countMap.get(p.id) ?? 0,
    teacher_name: p.teacher_id ? teacherMap.get(p.teacher_id) ?? null : null,
  }))

  return NextResponse.json({ programs: enriched })
}

/** POST /api/activity/programs */
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
  const parsed = ProgramUpsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const input = parsed.data

  // 카테고리로부터 byte_limit을 강제 설정 (기재요령 공식값)
  const category = findCategory(input.record_category)
  if (!category) {
    return NextResponse.json(
      { error: 'invalid_category' },
      { status: 400 }
    )
  }
  const byteLimit = category.limitBytes

  const { data: program, error } = await supabase
    .from('programs')
    .insert({
      academic_year: input.academic_year,
      department: input.department,
      program_date: input.program_date,
      program_name: input.program_name,
      setuk_template: input.setuk_template ?? null,
      record_category: input.record_category,
      target_grade: input.target_grade ?? null,
      byte_limit: byteLimit,
      teacher_id: teacher.id,
      status: input.status,
    })
    .select()
    .single()

  if (error || !program) {
    return NextResponse.json(
      { error: 'create_failed', message: error?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ program }, { status: 201 })
}
