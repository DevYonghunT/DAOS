import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'

export const runtime = 'nodejs'

/**
 * GET /api/activity/students/search?q=...&academic_year=2026
 *
 * 학번 우선, 이름 부분일치 보조 매칭.
 * 반환: [{ id, student_number, name, academic_year, grade, class_number, number_in_class }]
 *
 * 규칙:
 *  - q가 숫자/영숫자로만 구성 → student_number ilike 매칭 우선 (학번 정확도 높음)
 *  - 그 외 → name ilike 매칭
 *  - 결과엔 현재 학년도(academic_year) 등록 정보 조인 — 없으면 enroll=null
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const yearParam = url.searchParams.get('academic_year')
  const academicYear = yearParam ? Number(yearParam) : new Date().getFullYear()

  if (!q) {
    return NextResponse.json({ students: [] })
  }

  const isNumeric = /^[0-9]+$/.test(q)

  // 1차: 프로필 검색
  let profileQuery = supabase
    .from('student_profiles')
    .select('id, student_number, name')
    .eq('is_active', true)
    .limit(30)

  if (isNumeric) {
    // 학번 prefix 매칭 우선
    profileQuery = profileQuery.ilike('student_number', `${q}%`)
  } else {
    profileQuery = profileQuery.ilike('name', `%${q}%`)
  }

  const { data: profiles, error: pfErr } = await profileQuery
  if (pfErr) {
    return NextResponse.json({ error: pfErr.message }, { status: 500 })
  }

  const ids = (profiles ?? []).map((p) => p.id)
  if (ids.length === 0) {
    return NextResponse.json({ students: [] })
  }

  // 2차: 해당 학년도 소속 조회
  const { data: enrolls } = await supabase
    .from('student_enrollments')
    .select('student_id, academic_year, grade, class_number, number_in_class')
    .in('student_id', ids)
    .eq('academic_year', academicYear)

  const enrollMap = new Map(
    (enrolls ?? []).map((e) => [e.student_id, e])
  )

  const students = (profiles ?? []).map((p) => {
    const e = enrollMap.get(p.id) as
      | {
          academic_year: number
          grade: number
          class_number: number
          number_in_class: number | null
        }
      | undefined
    return {
      id: p.id,
      student_number: p.student_number,
      name: p.name,
      academic_year: e?.academic_year ?? null,
      grade: e?.grade ?? null,
      class_number: e?.class_number ?? null,
      number_in_class: e?.number_in_class ?? null,
    }
  })

  // 정렬: 학번 prefix 매칭이 우선 → 학번 오름차순
  students.sort((a, b) => a.student_number.localeCompare(b.student_number))

  return NextResponse.json({ students })
}
