import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** PATCH /api/admin/teachers/:id — role/department/subject/is_active 변경 */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher || !isAdmin(teacher)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: { role?: string; department?: string; subject?: string; is_active?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const allowed = ['teacher', 'admin', 'superadmin']
  if (body.role && !allowed.includes(body.role)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
  }

  // superadmin만 다른 사람을 superadmin으로 올릴 수 있음
  if (body.role === 'superadmin' && teacher.role !== 'superadmin') {
    return NextResponse.json({ error: 'only_superadmin_can_promote' }, { status: 403 })
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.role !== undefined) update.role = body.role
  if (body.department !== undefined) update.department = body.department
  if (body.subject !== undefined) update.subject = body.subject
  if (body.is_active !== undefined) update.is_active = body.is_active

  const { data, error } = await supabase
    .from('teachers')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'update_failed' }, { status: 500 })
  }

  // 감사 로그
  await supabase.from('audit_logs').insert({
    actor_id: teacher.id,
    action: 'role_change',
    target_type: 'teacher',
    target_id: id,
    details: body,
  })

  return NextResponse.json({ teacher: data })
}
