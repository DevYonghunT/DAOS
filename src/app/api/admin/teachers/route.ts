import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'

export const runtime = 'nodejs'

/** GET /api/admin/teachers — 전체 교사 목록 */
export async function GET() {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher || !isAdmin(teacher)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('teachers')
    .select('id, email, name, department, role, subject, is_active, created_at')
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ teachers: data ?? [] })
}
