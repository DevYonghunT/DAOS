import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserContext, isStudent, isTeacher } from '@/lib/auth/context'
import { ClassroomShell } from './classroom-shell'

export const dynamic = 'force-dynamic'

export default async function ClassroomLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx) redirect('/classroom/login')

  // 학생: 비밀번호 변경 강제
  if (isStudent(ctx) && !ctx.profile.password_changed) {
    redirect('/classroom/change-password')
  }

  // "t덕수고" → "덕수고" (t 접두사 제거)
  const rawName = ctx.profile.name
  const displayName =
    rawName.startsWith('t') && rawName.length > 1 && rawName.charCodeAt(1) > 127
      ? rawName.slice(1)
      : rawName

  return (
    <ClassroomShell
      userName={displayName}
      isTeacher={isTeacher(ctx)}
    >
      {children}
    </ClassroomShell>
  )
}
