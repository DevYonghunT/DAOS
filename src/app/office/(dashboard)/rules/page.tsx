import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'
import { DEFAULT_MODEL, isValidModel, type ModelId } from '@/lib/ai/models'
import { RulesClient } from './rules-client'
import type { UIMessage } from 'ai'

export const dynamic = 'force-dynamic'

type StoredMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

type PageProps = {
  searchParams: Promise<{ c?: string }>
}

export default async function RulesPage({ searchParams }: PageProps) {
  const { c: conversationId } = await searchParams

  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) redirect('/office/login')

  // 현재 효력 문서 수 (UI에 표시)
  const { count: documentCount } = await supabase
    .from('document_versions')
    .select('id', { count: 'exact', head: true })
    .eq('is_current', true)

  let initialMessages: UIMessage[] = []
  let activeConvId: string | null = null
  let activeModel: ModelId = DEFAULT_MODEL

  if (conversationId) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, model')
      .eq('id', conversationId)
      .eq('teacher_id', teacher.id)
      .eq('feature', 'rules')
      .maybeSingle()

    if (conv) {
      activeConvId = conv.id
      if (conv.model && isValidModel(conv.model)) {
        activeModel = conv.model
      }
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      initialMessages = ((msgs ?? []) as StoredMessage[]).map((m) => ({
        id: m.id,
        role: m.role,
        parts: [{ type: 'text', text: m.content }],
      }))
    }
  }

  return (
    <RulesClient
      key={activeConvId ?? 'new'}
      initialConversationId={activeConvId}
      initialMessages={initialMessages}
      initialModel={activeModel}
      documentCount={documentCount ?? 0}
    />
  )
}
