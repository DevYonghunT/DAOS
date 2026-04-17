import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'
import { callAIStructured } from '@/lib/ai/structured'
import { consultStructurePrompt } from '@/lib/ai/prompts/consult'
import { ConsultationSummarySchema } from '@/lib/consult/schema'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/consult/structurize
 * 비정형 상담 메모 → AI 구조화
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { raw_input: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const raw = body.raw_input?.trim()
  if (!raw) {
    return NextResponse.json({ error: 'empty_input' }, { status: 400 })
  }

  try {
    const summary = await callAIStructured({
      model: 'claude-haiku-4-5',
      system: consultStructurePrompt,
      messages: [{ role: 'user', content: raw }],
      feature: 'consult',
      teacherId: teacher.id,
      enableCache: true,
      schema: ConsultationSummarySchema,
      schemaName: 'ConsultationSummary',
      schemaDescription: '상담 메모 구조화 결과',
    })

    return NextResponse.json({ summary })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'structurize_failed',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
