'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { useParams } from 'next/navigation'
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  MoreVertical,
  Send,
  Trash2,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { Markdown } from '@/components/chat/markdown'
import { cn } from '@/lib/utils'

type Message = {
  id: string
  room_id: string
  sender_type: 'teacher' | 'student' | 'ai' | 'system'
  teacher_id: string | null
  student_id: string | null
  content: string
  sender_name: string
  mentions_ai: boolean
  created_at: string
}

type Member = {
  id: string
  member_type: string
  name: string
  student_number: string | null
}

type Room = {
  id: string
  title: string
  subject: string | null
  grade: number | null
  class_number: number | null
  description: string | null
}

export default function RoomChatPage() {
  const { id: roomId } = useParams<{ id: string }>()
  const [room, setRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showMembers, setShowMembers] = useState(true)
  const [showMention, setShowMention] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const supabaseRef = useRef(createClient())

  // 초기 로드
  const loadRoom = useCallback(async () => {
    const [roomRes, msgRes, memRes] = await Promise.all([
      fetch(`/api/classroom/rooms/${roomId}`),
      fetch(`/api/classroom/rooms/${roomId}/messages?limit=100`),
      fetch(`/api/classroom/rooms/${roomId}/members`),
    ])
    if (roomRes.ok) {
      const j = await roomRes.json()
      setRoom(j.room)
    }
    if (msgRes.ok) {
      const j = await msgRes.json()
      setMessages(j.messages ?? [])
    }
    if (memRes.ok) {
      const j = await memRes.json()
      setMembers(j.members ?? [])
    }
    setLoading(false)
  }, [roomId])

  useEffect(() => {
    setLoading(true)
    loadRoom()
  }, [loadRoom])

  // 메시지 목록 새로고침 (Realtime 없이도 동작)
  const refreshMessages = useCallback(async () => {
    const res = await fetch(`/api/classroom/rooms/${roomId}/messages?limit=100`)
    if (res.ok) {
      const json = await res.json()
      setMessages(json.messages ?? [])
    }
  }, [roomId])

  // Realtime 구독 (보조 — 다른 사용자 메시지 수신)
  useEffect(() => {
    const supabase = supabaseRef.current
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          refreshMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, refreshMessages])

  // 자동 스크롤 — 새 메시지 시 항상 하단으로
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [messages])

  const handleSend = async (e?: FormEvent) => {
    e?.preventDefault()
    const content = input.trim()
    if (!content || sending) return
    setInput('')
    setSending(true)
    setShowMention(false)
    try {
      const res = await fetch(`/api/classroom/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error || '전송 실패')
      } else {
        // 즉시 메시지 목록 새로고침 (본인 메시지 표시)
        await refreshMessages()

        // @AI 멘션 시 AI 응답 대기 후 추가 새로고침
        if (/@(AI|ai|Claude|claude|에이아이)\b/.test(content)) {
          // AI 응답은 5~15초 소요, 3초 간격으로 2번 폴링
          setTimeout(() => refreshMessages(), 4000)
          setTimeout(() => refreshMessages(), 10000)
          setTimeout(() => refreshMessages(), 18000)
        }
      }
    } catch {
      alert('전송 실패')
    } finally {
      setSending(false)
    }
  }

  const handleDeleteRoom = async () => {
    if (!confirm('이 방을 삭제(비활성화)할까요? 대화 기록은 보존되지만 방 목록에서 사라집니다.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/classroom/rooms/${roomId}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error || '삭제 실패')
        return
      }
      window.location.href = '/classroom'
    } catch {
      alert('삭제 실패')
    } finally {
      setDeleting(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#3B82F6]" />
      </div>
    )
  }

  const teachers = members.filter((m) => m.member_type === 'teacher')
  const students = members.filter((m) => m.member_type === 'student')

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* 상단바 */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="min-w-0 flex-1 mr-4">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-[#1E293B] truncate">
              {room?.title ?? '방'}
            </h2>
            <p className="text-[11px] text-[#64748B] shrink-0">
              {[room?.subject, room?.grade ? `${room.grade}학년` : null, room?.class_number ? `${room.class_number}반` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {room?.description && (
            <p className="text-[11px] text-[#94A3B8] truncate mt-0.5">
              {room.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMembers(!showMembers)}
            className="text-[#64748B]"
          >
            <Users className="h-4 w-4 mr-1" />
            {members.length}
            {showMembers ? <ChevronRight className="h-3 w-3 ml-1" /> : <ChevronLeft className="h-3 w-3 ml-1" />}
          </Button>
          {/* 더 보기 메뉴 */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMenu(!showMenu)}
              className="text-[#64748B] h-8 w-8 p-0"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-slate-200 bg-white shadow-lg py-1 w-48">
                  <a
                    href={`/api/classroom/rooms/${roomId}/export`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[#1E293B] hover:bg-[#F7F6F3]"
                    onClick={() => setShowMenu(false)}
                  >
                    <Download className="h-3.5 w-3.5 text-[#64748B]" />
                    대화 내보내기 (MD)
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false)
                      handleDeleteRoom()
                    }}
                    disabled={deleting}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    방 삭제
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 메시지 영역 */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* h-0 + grow = 남은 공간만 차지, 절대 확장 안 됨 → overflow-y-auto 작동 */}
          <div
            ref={scrollContainerRef}
            className="h-0 grow overflow-y-auto px-5 py-4"
          >
            <ul className="space-y-3">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
            </ul>
          </div>

          {/* 입력 */}
          <div className="border-t border-slate-200 bg-white px-5 py-3 shrink-0">
            <div className="relative">
              {/* @AI 자동완성 팝업 */}
              {showMention && (
                <div className="absolute bottom-full mb-1 left-0 z-10 rounded-lg border border-slate-200 bg-white shadow-lg p-1 w-52">
                  <button
                    type="button"
                    onClick={() => {
                      setInput((prev) => prev.replace(/@$/, '@AI '))
                      setShowMention(false)
                    }}
                    className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-[#EEF4FF] transition"
                  >
                    <Bot className="h-4 w-4 text-[#06B6D4]" />
                    <div className="text-left">
                      <p className="font-medium text-[#1E293B]">@AI</p>
                      <p className="text-[10px] text-[#64748B]">AI에게 질문하기</p>
                    </div>
                  </button>
                </div>
              )}
              <form onSubmit={handleSend} className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    // @ 입력 감지
                    const v = e.target.value
                    const lastChar = v.slice(-1)
                    setShowMention(lastChar === '@')
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="메시지 입력… @AI로 AI에게 질문"
                  rows={1}
                  className="resize-none bg-[#F7F6F3] border-transparent focus-visible:border-[#3B82F6] focus-visible:ring-0 min-h-[44px] max-h-[120px] text-sm flex-1"
                  disabled={sending}
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="h-11 shrink-0 bg-[#3B82F6] hover:bg-[#2563EB]"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
            <p className="text-[10px] text-[#94A3B8] mt-1 ml-1">
              @AI로 시작하면 AI가 답변합니다. 멘션 없으면 AI 호출 없음 (비용 절감).
            </p>
          </div>
        </div>

        {/* 멤버 패널 */}
        {showMembers && (
          <aside className="w-56 border-l border-slate-200 bg-white overflow-y-auto py-4 px-3">
            <p className="text-[11px] uppercase tracking-wider text-[#94A3B8] font-semibold px-1 mb-2">
              멤버 ({members.length})
            </p>
            {teachers.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-[#64748B] px-1 mb-1">교사</p>
                {teachers.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded text-sm">
                    <span className="text-[10px]">👨‍🏫</span>
                    <span className="text-[#1E293B] text-xs truncate">{m.name}</span>
                  </div>
                ))}
              </div>
            )}
            {students.length > 0 && (
              <div>
                <p className="text-[10px] text-[#64748B] px-1 mb-1">학생 ({students.length})</p>
                {students.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded text-sm">
                    <span className="text-[10px]">👤</span>
                    <span className="text-[#1E293B] text-xs truncate">{m.name}</span>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isSystem = msg.sender_type === 'system'
  const isAi = msg.sender_type === 'ai'
  const isTeacher = msg.sender_type === 'teacher'

  if (isSystem) {
    return (
      <li className="text-center">
        <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-[11px] text-[#64748B] italic">
          {msg.content}
        </span>
      </li>
    )
  }

  const icon = isAi ? '🤖' : isTeacher ? '👨‍🏫' : '👤'
  const bgClass = isAi
    ? 'bg-[#ECFEFF] border-[#06B6D4]/30'
    : isTeacher
      ? 'bg-[#EEF4FF] border-[#3B82F6]/20'
      : 'bg-white border-slate-200'

  return (
    <li className={cn('rounded-xl border p-3 shadow-sm', bgClass)}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs">{icon}</span>
        <span className="text-xs font-semibold text-[#1E293B]">
          {msg.sender_name}
        </span>
        <span className="text-[10px] text-[#94A3B8] ml-auto">
          {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="text-sm text-[#1E293B]">
        <Markdown content={msg.content} />
      </div>
    </li>
  )
}
