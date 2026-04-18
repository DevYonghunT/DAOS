import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'
import { DEFAULT_MODEL, isValidModel, type ModelId } from '@/lib/ai/models'
import { ChatClient } from './chat-client'
import { cn } from '@/lib/utils'
import type { UIMessage } from 'ai'

export const dynamic = 'force-dynamic'

type Conversation = {
  id: string
  title: string | null
  model: string | null
  updated_at: string | null
}

type StoredMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

type PageProps = {
  searchParams: Promise<{ c?: string }>
}

export default async function ChatPage({ searchParams }: PageProps) {
  const { c: conversationId } = await searchParams

  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) redirect('/office/login')

  const { data: conversationsRaw } = await supabase
    .from('conversations')
    .select('id, title, model, updated_at')
    .eq('teacher_id', teacher.id)
    .eq('feature', 'chat')
    .order('updated_at', { ascending: false })
    .limit(100)

  const conversations: Conversation[] = conversationsRaw ?? []

  let initialMessages: UIMessage[] = []
  let activeConvId: string | null = null
  let activeModel: ModelId = DEFAULT_MODEL

  if (conversationId) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, model')
      .eq('id', conversationId)
      .eq('teacher_id', teacher.id)
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
    <div className="flex h-screen">
      {/* 대화 목록 */}
      <aside className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-3 border-b border-slate-200">
          <Link href="/office/chat" prefetch={false}>
            <button
              type="button"
              className="w-full inline-flex items-center gap-2 justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#1E293B] hover:border-[#3B82F6]/40 hover:bg-[#F7F6F3] transition-colors"
            >
              <Plus className="h-4 w-4" />새 대화
            </button>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="px-4 py-6 text-xs text-[#64748B]">
              아직 대화가 없어요.
            </p>
          ) : (
            <ul className="py-2">
              {conversations.map((c) => {
                const isActive = c.id === activeConvId
                return (
                  <li key={c.id}>
                    <Link
                      href={`/office/chat?c=${c.id}`}
                      prefetch={false}
                      className={cn(
                        'flex items-start gap-2 px-3 py-2.5 text-sm transition-colors',
                        isActive
                          ? 'bg-[#F7F6F3] text-[#1E293B]'
                          : 'text-[#475569] hover:bg-[#F7F6F3]'
                      )}
                    >
                      <MessageSquare
                        className={cn(
                          'h-4 w-4 mt-0.5 shrink-0',
                          isActive ? 'text-[#3B82F6]' : 'text-[#94A3B8]'
                        )}
                      />
                      <span className="line-clamp-2 break-all text-[13px] leading-snug">
                        {c.title || '새 대화'}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* 채팅 영역 */}
      <div className="flex-1 min-w-0">
        <ChatClient
          key={activeConvId ?? 'new'}
          initialConversationId={activeConvId}
          initialMessages={initialMessages}
          initialModel={activeModel}
        />
      </div>
    </div>
  )
}
