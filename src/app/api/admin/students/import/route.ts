import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/admin/students/import
 *
 * CSV 텍스트 → student_profiles UPSERT + student_enrollments INSERT
 *
 * CSV 형식 (헤더 포함):
 *   학번,이름,성별,입학년도,학년,반,번호
 *   20260001,김덕수,M,2026,1,2,1
 *
 * 학번이 이미 있으면 프로필은 업데이트, enrollment는 해당 학년도에 INSERT (중복 무시)
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher || !isAdmin(teacher)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: { csv: string; academic_year?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const csv = body.csv?.trim()
  if (!csv) {
    return NextResponse.json({ error: 'empty_csv' }, { status: 400 })
  }
  const academicYear = body.academic_year ?? new Date().getFullYear()

  const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) {
    return NextResponse.json({ error: 'csv_too_short', message: '헤더 + 최소 1행 필요' }, { status: 400 })
  }

  // 헤더 스킵
  const rows = lines.slice(1)
  let created = 0
  let updated = 0
  let enrolled = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const cols = rows[i].split(',').map((c) => c.trim())
    if (cols.length < 7) {
      errors.push(`${i + 2}행: 열 수 부족 (${cols.length}/7)`)
      continue
    }

    const [studentNumber, name, gender, admYearStr, gradeStr, classStr, numStr] = cols
    const admYear = Number(admYearStr)
    const grade = Number(gradeStr)
    const classNum = Number(classStr)
    const numInClass = numStr ? Number(numStr) : null

    if (!studentNumber || !name || !isFinite(admYear) || !isFinite(grade) || !isFinite(classNum)) {
      errors.push(`${i + 2}행: 필수 필드 누락/오류`)
      continue
    }

    // UPSERT profile
    const { data: existing } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('student_number', studentNumber)
      .maybeSingle()

    let profileId: string
    if (existing) {
      await supabase
        .from('student_profiles')
        .update({ name, gender: gender || null, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      profileId = existing.id
      updated++
    } else {
      const { data: newP, error: pErr } = await supabase
        .from('student_profiles')
        .insert({
          student_number: studentNumber,
          name,
          gender: gender || null,
          admission_year: admYear,
          is_active: true,
        })
        .select('id')
        .single()
      if (pErr || !newP) {
        errors.push(`${i + 2}행: 프로필 생성 실패 (${pErr?.message})`)
        continue
      }
      profileId = newP.id
      created++
    }

    // 이전 학년도의 is_current를 false로 내림 (한 학생에 current가 하나만 유지)
    await supabase
      .from('student_enrollments')
      .update({ is_current: false })
      .eq('student_id', profileId)
      .neq('academic_year', academicYear)
      .eq('is_current', true)

    // Enrollment (중복 무시)
    const { error: eErr } = await supabase
      .from('student_enrollments')
      .upsert(
        {
          student_id: profileId,
          academic_year: academicYear,
          grade,
          class_number: classNum,
          number_in_class: numInClass,
          is_current: true,
        },
        { onConflict: 'student_id,academic_year' }
      )
    if (!eErr) enrolled++
  }

  // 감사 로그
  await supabase.from('audit_logs').insert({
    actor_id: teacher.id,
    action: 'csv_import',
    target_type: 'student',
    details: { academic_year: academicYear, total_rows: rows.length, created, updated, enrolled, error_count: errors.length },
  })

  return NextResponse.json({
    total_rows: rows.length,
    created,
    updated,
    enrolled,
    errors: errors.slice(0, 20),
  })
}
