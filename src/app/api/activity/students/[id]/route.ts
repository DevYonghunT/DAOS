import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'
import {
  RECORD_CATEGORIES,
  findCategory,
  type RecordCategoryKey,
} from '@/lib/activity/categories'
import { countNeisBytes } from '@/lib/activity/neis-bytes'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/activity/students/:id?academic_year=2026
 *
 * 학생 한 명의 해당 학년도 "카테고리별 세특 누적 현황" 반환.
 * - entries: 참여한 프로그램의 세특 템플릿 목록 (카테고리별)
 * - totalBytes: 카테고리 내 누적 바이트 (yearly 모드만 의미)
 * - per_entry 모드(봉사활동)는 항목별 한도, 누적 개념 없음
 */
export async function GET(req: Request, { params }: Params) {
  const { id: studentId } = await params
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const academicYear = Number(
    url.searchParams.get('academic_year') ?? new Date().getFullYear()
  )

  // 1. 학생 기본 정보 + 해당 학년도 소속
  const { data: profile } = await supabase
    .from('student_profiles')
    .select('id, student_number, name, is_active')
    .eq('id', studentId)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { data: enrollment } = await supabase
    .from('student_enrollments')
    .select('academic_year, grade, class_number, number_in_class')
    .eq('student_id', studentId)
    .eq('academic_year', academicYear)
    .maybeSingle()

  // 2. 이 학생이 참여한 이 학년도 프로그램들
  const { data: parts } = await supabase
    .from('program_participants')
    .select('program_id, created_at')
    .eq('student_id', studentId)

  const programIds = (parts ?? []).map((p) => p.program_id)

  let programs: Array<{
    id: string
    program_name: string
    program_date: string
    department: string
    record_category: string | null
    setuk_template: string | null
    byte_limit: number
    academic_year: number
  }> = []

  if (programIds.length > 0) {
    const { data: progs } = await supabase
      .from('programs')
      .select(
        'id, program_name, program_date, department, record_category, setuk_template, byte_limit, academic_year'
      )
      .in('id', programIds)
      .eq('academic_year', academicYear)
      .order('program_date', { ascending: true })
    programs = progs ?? []
  }

  // 3. 카테고리별로 그룹핑
  type Entry = {
    program_id: string
    program_name: string
    program_date: string
    department: string
    template: string | null
    bytes: number
  }

  const buckets = new Map<
    string,
    { entries: Entry[]; totalBytes: number }
  >()

  for (const p of programs) {
    const bytes = countNeisBytes(p.setuk_template)
    const key = p.record_category ?? 'uncategorized'
    const bucket = buckets.get(key) ?? { entries: [], totalBytes: 0 }
    bucket.entries.push({
      program_id: p.id,
      program_name: p.program_name,
      program_date: p.program_date,
      department: p.department,
      template: p.setuk_template,
      bytes,
    })
    bucket.totalBytes += bytes
    buckets.set(key, bucket)
  }

  // 4. 응답 형태 조립 — 학년이 확인된 경우 해당 학년의 카테고리 순서 사용
  const grade = enrollment?.grade ?? null
  const relevantCategories = RECORD_CATEGORIES
    .filter((c) =>
      grade ? c.grades.includes(grade as 1 | 2 | 3) : true
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const summary = relevantCategories.map((cat) => {
    const bucket = buckets.get(cat.key) ?? { entries: [], totalBytes: 0 }
    return {
      key: cat.key as RecordCategoryKey,
      label: cat.label,
      description: cat.description,
      limitBytes: cat.limitBytes,
      limitChars: cat.limitChars,
      mode: cat.mode,
      color: cat.color,
      entries: bucket.entries,
      totalBytes: bucket.totalBytes,
      entryCount: bucket.entries.length,
    }
  })

  // 카테고리 미분류 항목(예: 예전 버전 데이터)도 포함
  const extra: typeof summary = []
  for (const [key, bucket] of buckets) {
    if (relevantCategories.some((c) => c.key === key)) continue
    const cat = findCategory(key)
    extra.push({
      key: (cat?.key ?? key) as RecordCategoryKey,
      label: cat?.label ?? '기타',
      description: cat?.description ?? '카테고리 미지정 프로그램',
      limitBytes: cat?.limitBytes ?? 0,
      limitChars: cat?.limitChars ?? 0,
      mode: cat?.mode ?? 'yearly',
      color: cat?.color ?? 'slate',
      entries: bucket.entries,
      totalBytes: bucket.totalBytes,
      entryCount: bucket.entries.length,
    })
  }

  return NextResponse.json({
    student: {
      id: profile.id,
      student_number: profile.student_number,
      name: profile.name,
      academic_year: enrollment?.academic_year ?? academicYear,
      grade: enrollment?.grade ?? null,
      class_number: enrollment?.class_number ?? null,
      number_in_class: enrollment?.number_in_class ?? null,
    },
    summary: [...summary, ...extra],
  })
}
