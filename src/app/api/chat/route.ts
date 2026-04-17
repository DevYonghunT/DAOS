import { NextResponse } from 'next/server'
import { convertToModelMessages, type UIMessage } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai/call'
import { chatSystemPrompt } from '@/lib/ai/prompts/chat'
import { isValidModel, DEFAULT_MODEL, type ModelId } from '@/lib/ai/models'

export const runtime = 'nodejs'
export const maxDuration = 60

type ChatPayload = {
  messages: UIMessage[]
  model?: string
  conversationId?: string | null
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!teacher) {
    return NextResponse.json({ error: 'teacher_not_found' }, { status: 403 })
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

  // conversation 확보: 없으면 생성
  let conversationId = body.conversationId ?? null
  const lastUser = [...body.messages].reverse().find((m) => m.role === 'user')
  const lastUserText = lastUser ? uiMessageToText(lastUser) : ''

  if (!conversationId) {
    const title = lastUserText.slice(0, 40) || '새 대화'
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        teacher_id: teacher.id,
        title,
        model,
        feature: 'chat',
      })
      .select('id')
      .single()
    if (convErr || !conv) {
      console.error('[api/chat] conversation 생성 실패', convErr)
      return NextResponse.json(
        { error: 'conversation_create_failed' },
        { status: 500 }
      )
    }
    conversationId = conv.id
  }

  // 사용자 메시지 저장 (마지막 user 메시지만 — 이전 것은 이미 저장되어 있다고 가정)
  if (lastUserText) {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: lastUserText,
    })
  }

  const modelMessages = await convertToModelMessages(body.messages)

  const result = callAI({
    model,
    system: chatSystemPrompt,
    messages: modelMessages,
    feature: 'chat',
    teacherId: teacher.id,
    enableCache: true,
  })

  // onFinish에서 assistant 메시지 저장
  return result.toUIMessageStreamResponse({
    headers: {
      'X-Conversation-Id': conversationId ?? '',
    },
    onFinish: async ({ responseMessage }) => {
      try {
        const text = responseMessage.parts
          .filter((p) => p.type === 'text')
          .map((p) => ('text' in p ? p.text : ''))
          .join('')
        if (text.trim()) {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: text,
          })
          // conversation updated_at 갱신
          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId!)
        }
      } catch (err) {
        console.error('[api/chat] assistant 메시지 저장 실패', err)
      }
    },
  })
}

function uiMessageToText(msg: UIMessage): string {
  return msg.parts
    .filter((p) => p.type === 'text')
    .map((p) => ('text' in p ? p.text : ''))
    .join('')
    .trim()
}
