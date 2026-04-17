'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  GraduationCap,
  LogOut,
  MessageCircle,
  Plus,
  School,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type RoomSummary = {
  id: string
  title: string
  subject: string | null
  grade: number | null
  class_number: number | null
  last_message: { content: string; created_at: string; sender_type: string } | null
  member_count: number
}

type Props = {
  userName: string
  userType: 'teacher' | 'student'
  isTeacher: boolean
  children: React.ReactNode
}

export function ClassroomShell({ userName, userType, isTeacher, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [loading, setLoading] = useState(true)

  const loadRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/classroom/rooms')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setRooms(json.rooms ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadRooms() }, [loadRooms])

  // Realtime으로 방 목록 갱신 (방 메시지가 오면 목록 업데이트)
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('classroom-rooms-refresh')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'room_messages',
      }, () => {
        loadRooms()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadRooms])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/classroom/login'
  }

  const activeRoomId = pathname.startsWith('/classroom/rooms/')
    ? pathname.split('/')[3]
    : null

  return (
    <div className="flex h-screen bg-[#F7F6F3]">
      {/* 좌측 사이드바 */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col">
        {/* 헤더 */}
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-[#3B82F6] text-white flex items-center justify-center">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1E293B] truncate">AI 교실</p>
              <p className="text-[11px] text-[#64748B] truncate">{userName}</p>
            </div>
          </div>
          {isTeacher && (
            <Link href="/classroom/rooms/new">
              <Button className="w-full bg-[#3B82F6] hover:bg-[#2563EB] h-9">
                <Plus className="h-4 w-4 mr-1" />
                새 방 만들기
              </Button>
            </Link>
          )}
        </div>

        {/* 방 목록 */}
        <nav className="flex-1 overflow-y-auto py-2">
          {loading && (
            <p className="px-4 py-3 text-xs text-[#64748B]">불러오는 중…</p>
          )}
          {!loading && rooms.length === 0 && (
            <p className="px-4 py-6 text-xs text-[#64748B] text-center">
              {isTeacher ? '아직 방이 없습니다. 위에서 만들어보세요.' : '참여 중인 방이 없습니다.'}
            </p>
          )}
          {rooms.map((room) => {
            const isActive = activeRoomId === room.id
            return (
              <Link
                key={room.id}
                href={`/classroom/rooms/${room.id}`}
                className={cn(
                  'block px-4 py-3 border-b border-slate-100 hover:bg-[#F7F6F3] transition',
                  isActive && 'bg-[#EEF4FF] border-l-2 border-l-[#3B82F6]'
                )}
              >
                <div className="flex items-start gap-2">
                  <MessageCircle
                    className={cn(
                      'h-4 w-4 mt-0.5 shrink-0',
                      isActive ? 'text-[#3B82F6]' : 'text-[#94A3B8]'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1E293B] truncate">
                      {room.title}
                    </p>
                    <p className="text-[11px] text-[#64748B] truncate">
                      {[room.subject, room.grade ? `${room.grade}학년` : null, room.class_number ? `${room.class_number}반` : null]
                        .filter(Boolean)
                        .join(' · ') || '일반'}
                      {' · '}{room.member_count}명
                    </p>
                    {room.last_message && (
                      <p className="text-[11px] text-[#94A3B8] truncate mt-0.5">
                        {room.last_message.content.slice(0, 30)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </nav>

        {/* 하단 */}
        <div className="border-t border-slate-200 p-3 space-y-1">
          {isTeacher && (
            <Link
              href="/office"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-[#64748B] hover:bg-[#F7F6F3]"
            >
              <School className="h-3.5 w-3.5" />
              교무실로 이동
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs text-[#64748B] hover:bg-[#F7F6F3]"
          >
            <LogOut className="h-3.5 w-3.5" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 영역 */}
      <main className="flex-1 min-w-0 flex flex-col">
        {children}
      </main>
    </div>
  )
}
