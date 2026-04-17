import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'
import { DraftUpsertSchema } from '@/lib/setuk/schema'
import { findCategory } from '@/lib/activity/categories'
import { countNeisBytes } from '@/lib/activity/neis-bytes'

export const runtime = 'nodejs'

/** GET /api/setuk/drafts?year=2026&subject=career */
export async function GET(req: Request) {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const year = url.searchParams.get('year')
  const subject = url.searchParams.get('subject')

  let query = supabase
    .from('setuk_drafts')
    .select(
      'id, student_id, student_label, academic_year, subject, grade_class, keywords, draft, final_text, byte_limit, byte_used, status, created_at, updated_at'
    )
    .eq('teacher_id', teacher.id)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (year) query = query.eq('academic_year', Number(year))
  if (subject) query = query.eq('subject', subject)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ drafts: data ?? [] })
}

/** POST /api/setuk/drafts — 새 드래프트 저장 */
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

  const parsed = DraftUpsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const input = parsed.data

  // byte_limit: 카테고리 기반 자동 결정 (카테고리 키 매칭 시)
  const cat = findCategory(input.subject)
  const byteLimit = cat?.limitBytes ?? input.byte_limit ?? 1500
  const textForBytes = input.final_text?.trim() || input.draft?.trim() || ''
  const byteUsed = countNeisBytes(textForBytes)

  const { data, error } = await supabase
    .from('setuk_drafts')
    .insert({
      teacher_id: teacher.id,
      student_id: input.student_id ?? null,
      student_label: input.student_label,
      academic_year: input.academic_year,
      subject: input.subject,
      grade_class: input.grade_class ?? null,
      keywords: input.keywords ?? null,
      draft: input.draft ?? null,
      final_text: input.final_text ?? null,
      byte_limit: byteLimit,
      byte_used: byteUsed,
      status: input.status,
    })
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'create_failed', message: error?.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ draft: data }, { status: 201 })
}
