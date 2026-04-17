import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAllowedEmail } from '@/lib/auth/allowed-email'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'
import { Sidebar } from '@/components/dashboard/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/office/login')
  if (!isAllowedEmail(user.email)) {
    await supabase.auth.signOut()
    redirect('/auth/error?reason=forbidden_email')
  }

  const teacher = await getTeacherWithRole(supabase)

  const fallbackName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    '교사'

  // Google 계정 이름이 "t덕수고" 형태면 앞의 't' 제거
  const rawName = teacher?.name ?? fallbackName
  const teacherName =
    rawName.startsWith('t') && rawName.charCodeAt(1) > 127
      ? rawName.slice(1)
      : rawName
  const teacherEmail = teacher?.email ?? user.email ?? ''
  const teacherAvatar =
    teacher?.avatar_url ?? user.user_metadata?.avatar_url ?? null

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar
        teacherName={teacherName}
        teacherEmail={teacherEmail}
        teacherAvatarUrl={teacherAvatar}
        isAdmin={isAdmin(teacher)}
      />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
