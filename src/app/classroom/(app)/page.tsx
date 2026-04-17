import { createClient } from '@/lib/supabase/server'
import { getCurrentUserContext, isTeacher } from '@/lib/auth/context'
import { GraduationCap, MessageCircle, Users } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ClassroomHomePage() {
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  const teacher = ctx && isTeacher(ctx)
  const name = ctx?.profile.name ?? '사용자'

  // 간단한 통계
  const { count: roomCount } = await supabase
    .from('rooms')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#3B82F6] text-white mb-5">
          <GraduationCap className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-[#1E293B] mb-2">
          환영합니다, {name}{teacher ? ' 선생님' : ''}
        </h1>
        <p className="text-sm text-[#64748B] mb-8">
          {teacher
            ? '좌측에서 기존 방을 선택하거나, 새 방을 만들어 시작하세요.'
            : '좌측에서 참여할 방을 선택하세요.'}
        </p>

        <div className="flex justify-center gap-4 mb-8">
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-center">
            <MessageCircle className="h-5 w-5 text-[#3B82F6] mx-auto mb-1" />
            <p className="text-lg font-bold text-[#1E293B]">{roomCount ?? 0}</p>
            <p className="text-[11px] text-[#64748B]">
              {teacher ? '내 방' : '참여 방'}
            </p>
          </div>
        </div>

        {teacher && (
          <Link
            href="/classroom/rooms/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#3B82F6] text-white px-6 py-2.5 text-sm hover:bg-[#2563EB] transition"
          >
            + 새 방 만들기
          </Link>
        )}
      </div>
    </div>
  )
}
