import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'
import { ConsultUpsertSchema } from '@/lib/consult/schema'

export const runtime = 'nodejs'

/** GET /api/consult?student_id=...&year=2026 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const studentId = url.searchParams.get('student_id')
  const year = url.searchParams.get('year')

  let query = supabase
    .from('consultations')
    .select('*')
    .order('consultation_date', { ascending: false })
    .limit(200)

  if (studentId) query = query.eq('student_id', studentId)
  if (year) query = query.eq('academic_year', Number(year))

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 학생 정보 조인
  const studentIds = Array.from(new Set((data ?? []).map((c) => c.student_id)))
  const studentMap = new Map<string, { name: string; student_number: string }>()
  if (studentIds.length > 0) {
    const { data: profiles } = await supabase
      .from('student_profiles')
      .select('id, name, student_number')
      .in('id', studentIds)
    for (const p of profiles ?? []) {
      studentMap.set(p.id, { name: p.name, student_number: p.student_number })
    }
  }

  const enriched = (data ?? []).map((c) => {
    const s = studentMap.get(c.student_id)
    return {
      ...c,
      student_name: s?.name ?? null,
      student_number: s?.student_number ?? null,
    }
  })

  return NextResponse.json({ consultations: enriched })
}

/** POST /api/consult */
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

  const parsed = ConsultUpsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const input = parsed.data
  const { data, error } = await supabase
    .from('consultations')
    .insert({
      student_id: input.student_id,
      teacher_id: teacher.id,
      academic_year: input.academic_year,
      consultation_date: input.consultation_date,
      attendees: input.attendees ?? null,
      raw_input: input.raw_input ?? null,
      structured_summary: input.structured_summary ?? null,
      follow_up_date: input.follow_up_date ?? null,
      is_completed: input.is_completed,
    })
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'create_failed', message: error?.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ consultation: data }, { status: 201 })
}
