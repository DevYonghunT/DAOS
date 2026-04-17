import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'
import { DocumentsClient } from './documents-client'

export const dynamic = 'force-dynamic'

export default async function AdminDocumentsPage() {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) redirect('/office/login')
  if (!isAdmin(teacher)) redirect('/office')

  return <DocumentsClient />
}
