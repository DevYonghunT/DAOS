import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserContext, isTeacher } from '@/lib/auth/context'

export const runtime = 'nodejs'

/** GET /api/classroom/students/search?q=...&academic_year=2026 — 교사만 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx || !isTeacher(ctx)) {
    return NextResponse.json({ error: 'teachers_only' }, { status: 403 })
  }

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const year = Number(url.searchParams.get('academic_year') ?? new Date().getFullYear())

  if (!q) return NextResponse.json({ students: [] })

  const isNumeric = /^[0-9]+$/.test(q)
  let profileQuery = supabase
    .from('student_profiles')
    .select('id, student_number, name')
    .eq('is_active', true)
    .limit(30)

  if (isNumeric) {
    profileQuery = profileQuery.ilike('student_number', `${q}%`)
  } else {
    profileQuery = profileQuery.ilike('name', `%${q}%`)
  }

  const { data: profiles } = await profileQuery
  const ids = (profiles ?? []).map((p) => p.id)
  if (ids.length === 0) return NextResponse.json({ students: [] })

  const { data: enrolls } = await supabase
    .from('student_enrollments')
    .select('student_id, grade, class_number, number_in_class')
    .in('student_id', ids)
    .eq('academic_year', year)

  const enrollMap = new Map(
    (enrolls ?? []).map((e) => [e.student_id, e])
  )

  const students = (profiles ?? []).map((p) => {
    const e = enrollMap.get(p.id)
    return {
      id: p.id,
      student_number: p.student_number,
      name: p.name,
      grade: e?.grade ?? null,
      class_number: e?.class_number ?? null,
      number_in_class: e?.number_in_class ?? null,
    }
  })

  return NextResponse.json({ students })
}
