import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'

export const runtime = 'nodejs'

/**
 * GET /api/activity/summary?academic_year=2026&grade=1&sort=participations&dir=desc
 *
 * 학년별 참여현황 대시보드 데이터.
 * student_participation_summary 뷰에서 읽어옴 (security_invoker = true).
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const year = Number(
    url.searchParams.get('academic_year') ?? new Date().getFullYear()
  )
  const gradeParam = url.searchParams.get('grade')
  const grade = gradeParam && gradeParam !== 'all' ? Number(gradeParam) : null
  const sort = url.searchParams.get('sort') ?? 'participations'
  const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc'

  let query = supabase
    .from('student_participation_summary')
    .select('*')
    .eq('academic_year', year)
    .limit(2000)

  if (grade) query = query.eq('grade', grade)

  // 정렬
  if (sort === 'participations') {
    query = query.order('total_participations', { ascending: dir === 'asc' })
  } else if (sort === 'class') {
    query = query
      .order('grade', { ascending: true })
      .order('class_number', { ascending: true })
      .order('number_in_class', { ascending: true })
  } else {
    query = query.order('name', { ascending: true })
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rows: data ?? [] })
}
