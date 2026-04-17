import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'
import { runLocalChecks } from '@/lib/review/local-checks'
import { callAIStructured } from '@/lib/ai/structured'
import { reviewSystemPrompt } from '@/lib/ai/prompts/review'
import { ReviewResponseSchema } from '@/lib/review/schema'
import { findCategory } from '@/lib/activity/categories'

export const runtime = 'nodejs'
export const maxDuration = 60

type ReviewPayload = {
  text: string
  byte_limit?: number
  /** 기재 영역 key (카탈로그 기반). 한도 자동 결정에 사용. */
  record_category?: string
  /** LLM 검수 스킵 옵션 (로컬만 실행) */
  skip_llm?: boolean
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: ReviewPayload
  try {
    body = (await req.json()) as ReviewPayload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const text = body.text?.trim() ?? ''
  if (!text) {
    return NextResponse.json({ error: 'empty_text' }, { status: 400 })
  }

  // 영역으로부터 바이트 한도 추정 (우선순위: body.byte_limit > category 한도 > 500)
  const category = findCategory(body.record_category)
  const byteLimit =
    body.byte_limit ?? category?.limitBytes ?? 1500

  // 1단계: 로컬 검수 (즉시)
  const local = runLocalChecks(text, byteLimit)

  // 2단계: LLM 검수 (옵션)
  let llm: Awaited<ReturnType<typeof callAIStructured<typeof ReviewResponseSchema>>> | null = null
  let llmError: string | null = null
  if (!body.skip_llm) {
    try {
      llm = await callAIStructured({
        model: 'claude-haiku-4-5',
        system: reviewSystemPrompt(category?.label),
        messages: [
          {
            role: 'user',
            content: `다음 세특 텍스트를 검토해주세요.\n\n${text}`,
          },
        ],
        feature: 'review',
        teacherId: teacher.id,
        enableCache: true,
        schema: ReviewResponseSchema,
        schemaName: 'SetukReview',
        schemaDescription: '세특 검수 제안 목록',
      })
    } catch (err) {
      console.error('[api/review] LLM 검수 실패', err)
      llmError = err instanceof Error ? err.message : 'LLM 검수 실패'
    }
  }

  return NextResponse.json({
    local,
    llm: llm
      ? {
          overall_comment: llm.overall_comment,
          suggestions: llm.suggestions,
        }
      : null,
    llm_error: llmError,
    category: category
      ? {
          key: category.key,
          label: category.label,
          limitBytes: category.limitBytes,
          limitChars: category.limitChars,
        }
      : null,
  })
}
