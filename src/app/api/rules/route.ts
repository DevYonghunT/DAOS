import { NextResponse } from 'next/server'
import { convertToModelMessages, type UIMessage } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'
import { callAI } from '@/lib/ai/call'
import {
  composeRulesSystem,
  type DocumentBlock,
} from '@/lib/ai/prompts/rules'
import { isValidModel, DEFAULT_MODEL, type ModelId } from '@/lib/ai/models'
import { searchRelevantChunks } from '@/lib/documents/search'

export const runtime = 'nodejs'
export const maxDuration = 60

type ChatPayload = {
  messages: UIMessage[]
  model?: string
  conversationId?: string | null
}

/**
 * POST /api/rules
 *
 * 학교 규정 RAG 채팅.
 * 전체 청크를 넣는 대신, 사용자 질문 키워드로 관련 청크만 선별 (80k 토큰 이내).
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: ChatPayload
  try {
    body = (await req.json()) as ChatPayload
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: 'empty_messages' }, { status: 400 })
  }

  const model: ModelId =
    body.model && isValidModel(body.model) ? body.model : DEFAULT_MODEL

  const lastUser = [...body.messages].reverse().find((m) => m.role === 'user')
  const lastUserText = lastUser ? uiMessageToText(lastUser) : ''

  // 1. 질문 관련 청크만 검색 (토큰 버짓 80k 이내)
  const relevantChunks = await searchRelevantChunks(supabase, lastUserText)

  // 청크를 DocumentBlock 형태로 조립
  const blockMap = new Map<string, DocumentBlock>()
  for (const c of relevantChunks) {
    const key = `${c.document_title}__${c.version_number}`
    const existing = blockMap.get(key)
    const chunkText = c.heading ? `### ${c.heading}\n${c.content}` : c.content
    if (existing) {
      existing.body += '\n\n' + chunkText
    } else {
      blockMap.set(key, {
        documentTitle: c.document_title,
        category: c.document_category,
        version: c.version_number,
        effectiveDate: c.effective_date,
        body: chunkText,
      })
    }
  }
  const blocks = Array.from(blockMap.values())

  // 2. conversation 확보
  let conversationId = body.conversationId ?? null
  if (!conversationId) {
    const title = lastUserText.slice(0, 40) || '학교 규정 문의'
    const { data: conv } = await supabase
      .from('conversations')
      .insert({
        teacher_id: teacher.id,
        title,
        model,
        feature: 'rules',
      })
      .select('id')
      .single()
    conversationId = conv?.id ?? null
  }
  if (lastUserText && conversationId) {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: lastUserText,
    })
  }

  const modelMessages = await convertToModelMessages(body.messages)
  const system = composeRulesSystem(blocks)

  try {
    const result = callAI({
      model,
      system,
      messages: modelMessages,
      feature: 'rules',
      teacherId: teacher.id,
      enableCache: true,
    })

    return result.toUIMessageStreamResponse({
      headers: {
        'X-Conversation-Id': conversationId ?? '',
        'X-Doc-Count': String(blocks.length),
        'X-Chunk-Count': String(relevantChunks.length),
      },
      onFinish: async ({ responseMessage }) => {
        try {
          const text = responseMessage.parts
            .filter((p) => p.type === 'text')
            .map((p) => ('text' in p ? p.text : ''))
            .join('')
          if (text.trim() && conversationId) {
            await supabase.from('messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: text,
            })
            await supabase
              .from('conversations')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', conversationId)
          }
        } catch (err) {
          console.error('[api/rules] assistant 메시지 저장 실패', err)
        }
      },
    })
  } catch (err) {
    console.error('[api/rules] callAI 실패', err)
    return NextResponse.json(
      {
        error: 'rules_failed',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}

function uiMessageToText(msg: UIMessage): string {
  return msg.parts
    .filter((p) => p.type === 'text')
    .map((p) => ('text' in p ? p.text : ''))
    .join('')
    .trim()
}
