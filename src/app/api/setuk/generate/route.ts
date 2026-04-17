import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'
import { callAI } from '@/lib/ai/call'
import { setukSystemPrompt, buildSetukUserMessage } from '@/lib/ai/prompts/setuk'
import { createMappings } from '@/lib/ai/deidentify'
import { findCategory } from '@/lib/activity/categories'

export const runtime = 'nodejs'
export const maxDuration = 60

type GeneratePayload = {
  student_id: string
  record_category: string
  academic_year?: number
  keywords?: string
}

/**
 * POST /api/setuk/generate
 *
 * 학생 한 명에 대해 선택한 영역의 세특 초안을 스트리밍으로 생성.
 *  1. 학생·소속·참여 활동 조회 (Phase 3 데이터)
 *  2. 실명 → 라벨 비식별화 매핑 생성 + LLM 호출 시 치환
 *  3. callAI (streaming) 로 초안 생성
 *  4. 재식별화는 클라이언트가 저장 시점에 필요 (본 API는 라벨 그대로 반환)
 *
 * 응답: UI message stream. X-Student-Label 헤더로 라벨 전달.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: GeneratePayload
  try {
    body = (await req.json()) as GeneratePayload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const category = findCategory(body.record_category)
  if (!category) {
    return NextResponse.json({ error: 'invalid_category' }, { status: 400 })
  }
  const academicYear = body.academic_year ?? new Date().getFullYear()

  // 학생 조회
  const { data: profile } = await supabase
    .from('student_profiles')
    .select('id, name, student_number')
    .eq('id', body.student_id)
    .maybeSingle()
  if (!profile) {
    return NextResponse.json({ error: 'student_not_found' }, { status: 404 })
  }

  const { data: enrollment } = await supabase
    .from('student_enrollments')
    .select('grade, class_number, number_in_class')
    .eq('student_id', body.student_id)
    .eq('academic_year', academicYear)
    .maybeSingle()

  const gradeClass = enrollment
    ? `${enrollment.grade}-${enrollment.class_number}-${enrollment.number_in_class ?? '?'}`
    : null

  // 해당 학년도 + 해당 영역 참여 활동
  const { data: parts } = await supabase
    .from('program_participants')
    .select('program_id')
    .eq('student_id', body.student_id)
  const programIds = (parts ?? []).map((p) => p.program_id)

  let activities: Array<{
    program_name: string
    program_date: string
    department: string
    template: string | null
  }> = []

  if (programIds.length > 0) {
    const { data: progs } = await supabase
      .from('programs')
      .select(
        'id, program_name, program_date, department, setuk_template, record_category, academic_year'
      )
      .in('id', programIds)
      .eq('academic_year', academicYear)
      .eq('record_category', body.record_category)
      .order('program_date', { ascending: true })
    activities = (progs ?? []).map((p) => ({
      program_name: p.program_name,
      program_date: p.program_date,
      department: p.department,
      template: p.setuk_template,
    }))
  }

  // 비식별화: 이 학생 이름을 "학생A"로 매핑. (활동 템플릿에 이름이 들어있어도 안전)
  const studentLabel = '학생A'
  const deidentifyMap = createMappings([profile.name])

  const system = setukSystemPrompt({
    categoryKey: category.key,
    byteLimit: category.limitBytes,
    studentLabel,
    academicYear,
  })

  const userMessage = buildSetukUserMessage({
    studentLabel,
    gradeClass,
    academicYear,
    activities,
    extraKeywords: body.keywords ?? null,
  })

  try {
    const result = callAI({
      model: 'claude-haiku-4-5',
      system,
      messages: [{ role: 'user', content: userMessage }],
      feature: 'setuk',
      teacherId: teacher.id,
      enableCache: true,
      deidentifyMap,
    })

    // text/plain 스트림으로 — 클라이언트에서 fetch+reader로 간단히 읽기 좋음
    // ⚠️ HTTP 헤더는 ASCII만 허용 → 한글 포함 값은 URL-encode 필요
    return result.toTextStreamResponse({
      headers: {
        'X-Student-Label': encodeURIComponent(studentLabel),
        'X-Student-Number': profile.student_number,
        'X-Activity-Count': String(activities.length),
        'X-Byte-Limit': String(category.limitBytes),
      },
    })
  } catch (err) {
    console.error('[api/setuk/generate] callAI 실패', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      {
        error: 'generate_failed',
        message,
        // 디버그용 컨텍스트
        debug: {
          model: 'claude-haiku-4-5',
          activity_count: activities.length,
          student_label: studentLabel,
          academic_year: academicYear,
          category: category.key,
        },
      },
      { status: 500 }
    )
  }
}
