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
import { BookOpen, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Markdown } from '@/components/chat/markdown'
import { MODELS, DEFAULT_MODEL, type ModelId } from '@/lib/ai/models'
import { cn } from '@/lib/utils'

type Props = {
  initialConversationId: string | null
  initialMessages: UIMessage[]
  initialModel?: ModelId
  documentCount: number
}

const EXAMPLES = [
  '학교 출결 처리 절차가 어떻게 되나요?',
  '학생 표창 추천 기준이 뭔가요?',
  '교사 복무 관련 휴가 종류 알려주세요',
  '학사일정상 1학기 기말고사는 언제인가요?',
]

export function RulesClient({
  initialConversationId,
  initialMessages,
  initialModel,
  documentCount,
}: Props) {
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
        api: '/api/rules',
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
    onFinish: () => router.refresh(),
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
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="h-4 w-4 text-[#06B6D4]" />
          <h1 className="text-sm font-semibold text-[#1E293B] truncate">
            학교 규정 안내
          </h1>
          <Badge
            variant="outline"
            className="ml-2 bg-[#EEF4FF] text-[#3B82F6] border-[#3B82F6]/20 text-[10px] font-normal"
          >
            현재 등록 문서 {documentCount}건
          </Badge>
        </div>
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
                  <span className="text-[11px] text-[#64748B]">{m.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <div className="flex-1 overflow-y-auto bg-[#F7F6F3]">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {messages.length === 0 ? (
            <EmptyState
              documentCount={documentCount}
              onPick={(text) => setInput(text)}
            />
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

      <footer className="border-t border-slate-200 bg-white px-6 py-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                documentCount === 0
                  ? '관리자가 규정 문서를 업로드해야 답변할 수 있습니다.'
                  : '학교 규정·계획서·업무지침에 대해 질문하세요. (Shift+Enter로 줄바꿈)'
              }
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
            답변은 등록된 규정 문서 본문에 한해 생성되며, 출처가 함께 제공됩니다.
          </p>
        </form>
      </footer>
    </div>
  )
}

function EmptyState({
  documentCount,
  onPick,
}: {
  documentCount: number
  onPick: (text: string) => void
}) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF4FF] text-[#3B82F6] mb-4">
        <BookOpen className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-[#1E293B] mb-2">
        무엇이 궁금하신가요?
      </h2>
      <p className="text-sm text-[#64748B] mb-1">
        학교 규정·계획서·업무지침에서 답을 찾아 인용해 드립니다.
      </p>
      <p className="text-xs text-[#94A3B8] mb-8">
        {documentCount > 0
          ? `현재 ${documentCount}건의 문서가 등록되어 있습니다.`
          : '등록된 문서가 없습니다. 관리자 → 문서 관리에서 업로드하세요.'}
      </p>
      {documentCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto">
          {EXAMPLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm text-[#1E293B] hover:border-[#3B82F6]/40 hover:bg-[#F7F6F3] transition"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#3B82F6] inline mr-1.5" />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
