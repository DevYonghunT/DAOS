'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useChat } from '@ai-sdk/react'
import { Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Markdown } from '@/components/chat/markdown'
import { MODELS, DEFAULT_MODEL, type ModelId } from '@/lib/ai/models'
import { cn } from '@/lib/utils'

type ChatClientProps = {
  initialConversationId: string | null
  initialMessages: UIMessage[]
  initialModel?: ModelId
}

export function ChatClient({
  initialConversationId,
  initialMessages,
  initialModel,
}: ChatClientProps) {
  const router = useRouter()
  const [model, setModel] = useState<ModelId>(initialModel ?? DEFAULT_MODEL)
  const conversationIdRef = useRef<string | null>(initialConversationId)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const modelRef = useRef(model)
  useEffect(() => {
    modelRef.current = model
  }, [model])

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: () => ({
          model: modelRef.current,
          conversationId: conversationIdRef.current,
        }),
        fetch: async (input, init) => {
          const res = await fetch(input, init)
          const newId = res.headers.get('x-conversation-id')
          if (newId && newId !== conversationIdRef.current) {
            conversationIdRef.current = newId
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href)
              url.searchParams.set('c', newId)
              window.history.replaceState(null, '', url.toString())
            }
          }
          return res
        },
      }),
    []
  )

  const { messages, sendMessage, status, error, stop } = useChat({
    transport,
    messages: initialMessages,
    onFinish: () => {
      router.refresh()
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const isStreaming = status === 'submitted' || status === 'streaming'
  const canSubmit = input.trim().length > 0 && !isStreaming

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSubmit) return
    const text = input.trim()
    setInput('')
    sendMessage({ text })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* 상단 바 */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-[#06B6D4]" />
          <h1 className="text-sm font-semibold text-[#1E293B] truncate">
            AI 어시스턴트
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={model}
            onValueChange={(v) => setModel(v as ModelId)}
            disabled={isStreaming}
          >
            <SelectTrigger className="h-9 w-[180px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(MODELS).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex flex-col">
                    <span className="text-sm">{m.name}</span>
                    <span className="text-[11px] text-[#64748B]">
                      {m.label}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto bg-[#F7F6F3]">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-6">
              {messages.map((msg) => (
                <li
                  key={msg.id}
                  className={cn(
                    'flex',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-3 max-w-[85%] shadow-sm',
                      msg.role === 'user'
                        ? 'bg-[#3B82F6] text-white'
                        : 'bg-white border border-slate-200'
                    )}
                  >
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {msg.parts
                          .filter((p) => p.type === 'text')
                          .map((p) => ('text' in p ? p.text : ''))
                          .join('')}
                      </p>
                    ) : (
                      <Markdown
                        content={msg.parts
                          .filter((p) => p.type === 'text')
                          .map((p) => ('text' in p ? p.text : ''))
                          .join('')}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              오류가 발생했습니다: {error.message}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 입력 영역 */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="질문을 입력하세요. (Shift+Enter로 줄바꿈)"
              rows={1}
              className="resize-none bg-[#F7F6F3] border-transparent focus-visible:border-[#3B82F6] focus-visible:ring-0 min-h-[44px] max-h-[200px] text-sm"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button
                type="button"
                onClick={() => stop()}
                variant="outline"
                className="h-11 shrink-0"
              >
                중단
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!canSubmit}
                className="h-11 shrink-0 bg-[#3B82F6] hover:bg-[#2563EB]"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-[#64748B]">
            학생 실명, 주민번호 등 민감정보는 입력하지 마세요.
          </p>
        </form>
      </footer>
    </div>
  )
}

function EmptyState() {
  const suggestions = [
    '이번 주 수업 준비 체크리스트 만들어줘',
    '학생 생활지도 상담 시작 방법 추천해줘',
    '과학 교과 수행평가 루브릭 예시 3가지',
    '학부모 상담 안내문 초안 작성',
  ]
  return (
    <div className="text-center py-16">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF4FF] text-[#3B82F6] mb-4">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-[#1E293B] mb-2">
        무엇을 도와드릴까요?
      </h2>
      <p className="text-sm text-[#64748B] mb-8">
        수업·상담·행정 업무 관련 질문을 자유롭게 해보세요.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto">
        {suggestions.map((s) => (
          <div
            key={s}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm text-[#1E293B]"
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  )
}
