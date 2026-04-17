import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'
import { ActivityClient } from './activity-client'

export const dynamic = 'force-dynamic'

export default async function ActivityPage() {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) redirect('/office/login')

  const currentYear = new Date().getFullYear()
  // 사용 가능한 학년도: 현재 ± 2년
  const availableYears = [
    currentYear - 2,
    currentYear - 1,
    currentYear,
    currentYear + 1,
  ]

  return (
    <ActivityClient
      initialAcademicYear={currentYear}
      canManage={isAdmin(teacher)}
      selfTeacherId={teacher.id}
      availableYears={availableYears}
    />
  )
}
