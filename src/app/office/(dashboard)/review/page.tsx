import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'
import { ReviewClient } from './review-client'

export const dynamic = 'force-dynamic'

export default async function ReviewPage() {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) redirect('/office/login')

  return <ReviewClient />
}
