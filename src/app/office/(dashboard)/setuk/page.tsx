import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'
import { SetukClient } from './setuk-client'

export const dynamic = 'force-dynamic'

export default async function SetukPage() {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) redirect('/office/login')

  const currentYear = new Date().getFullYear()
  const availableYears = [
    currentYear - 2,
    currentYear - 1,
    currentYear,
    currentYear + 1,
  ]

  return (
    <SetukClient
      initialAcademicYear={currentYear}
      availableYears={availableYears}
    />
  )
}
