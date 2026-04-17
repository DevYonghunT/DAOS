import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/context'
import { generateAI } from '@/lib/ai/call'
import { buildClassroomSystemPrompt } from '@/lib/ai/prompts/classroom'
import { isValidModel, type ModelId } from '@/lib/ai/models'

export const runtime = 'nodejs'
export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/classroom/rooms/:id/ai-respond
 *
 * @AI 멘션된 메시지 후 호출. 페르소나 + 자료 + 최근 히스토리 기반 AI 응답 생성.
 * 응답은 room_messages에 sender_type='ai'로 INSERT → Realtime 전달.
 */
export async function POST(req: Request, { params }: Params) {
  const { id: roomId } = await params
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // 방 정보
  const { data: room } = await supabase
    .from('rooms')
    .select('id, title, subject, grade, class_number, persona_prompt, ai_model, created_by')
    .eq('id', roomId)
    .maybeSingle()
  if (!room) return NextResponse.json({ error: 'room_not_found' }, { status: 404 })

  // 생성 교사 이름
  const { data: creator } = await supabase
    .from('teachers')
    .select('id, name')
    .eq('id', room.created_by)
    .maybeSingle()

  // 멤버 수
  const { count: memberCount } = await supabase
    .from('room_members')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId)
    .eq('is_active', true)

  // 첨부 자료
  const { data: attachments } = await supabase
    .from('room_attachments')
    .select('filename, full_text, token_count')
    .eq('room_id', roomId)

  // 최근 30개 메시지
  const { data: recentMsgs } = await supabase
    .from('room_messages')
    .select('sender_type, teacher_id, student_id, content')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(30)

  // 발신자 이름 매핑
  const tIds = new Set<string>()
  const sIds = new Set<string>()
  for (const m of recentMsgs ?? []) {
    if (m.teacher_id) tIds.add(m.teacher_id)
    if (m.student_id) sIds.add(m.student_id)
  }
  const nameMap = new Map<string, string>()
  if (tIds.size > 0) {
    const { data } = await supabase.from('teachers').select('id, name').in('id', [...tIds])
    for (const t of data ?? []) nameMap.set(t.id, t.name)
  }
  if (sIds.size > 0) {
    const { data } = await supabase.from('student_profiles').select('id, name').in('id', [...sIds])
    for (const s of data ?? []) nameMap.set(s.id, s.name)
  }

  // 시스템 프롬프트 조립
  const system = buildClassroomSystemPrompt(
    {
      title: room.title,
      subject: room.subject,
      grade: room.grade,
      classNumber: room.class_number,
      personaPrompt: room.persona_prompt,
      teacherName: creator?.name ?? '교사',
      memberCount: memberCount ?? 0,
    },
    (attachments ?? []).map((a) => ({
      filename: a.filename,
      fullText: a.full_text,
      tokenCount: a.token_count,
    }))
  )

  // 메시지 히스토리 → Claude messages 형태
  const messages = (recentMsgs ?? []).reverse().map((m) => {
    if (m.sender_type === 'ai') {
      return { role: 'assistant' as const, content: m.content }
    }
    const senderName =
      m.sender_type === 'system'
        ? '시스템'
        : nameMap.get(m.teacher_id ?? m.student_id ?? '') ?? '사용자'
    const role = m.sender_type === 'teacher' ? '교사' : '학생'
    return {
      role: 'user' as const,
      content: `[${senderName} (${role})] ${m.content}`,
    }
  })

  // AI 모델 결정
  const model: ModelId =
    room.ai_model && isValidModel(room.ai_model)
      ? room.ai_model
      : 'claude-haiku-4-5'

  try {
    const result = await generateAI({
      model,
      system,
      messages,
      feature: 'classroom',
      teacherId: room.created_by,
      enableCache: true,
    })

    // AI 응답을 room_messages에 INSERT
    await supabase.from('room_messages').insert({
      room_id: roomId,
      sender_type: 'ai',
      content: result.text,
      tokens_input: result.tokensInput,
      tokens_output: result.tokensOutput,
      mentions_ai: false,
    })

    return NextResponse.json({
      ok: true,
      tokens: result.tokensInput + result.tokensOutput,
    })
  } catch (err) {
    console.error('[ai-respond] 실패:', err)
    // 에러 시 시스템 메시지
    await supabase.from('room_messages').insert({
      room_id: roomId,
      sender_type: 'system',
      content: '⚠️ AI 응답 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
    })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ai_failed' },
      { status: 500 }
    )
  }
}
