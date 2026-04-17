import type { SupabaseClient } from '@supabase/supabase-js'

export type TeacherRole = 'teacher' | 'admin' | 'superadmin'

export type Teacher = {
  id: string
  auth_user_id: string
  email: string
  name: string
  department: string | null
  role: TeacherRole
  subject: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * 현재 로그인된 사용자의 teachers 레코드를 role과 함께 조회한다.
 * - auth.getUser() 실패 또는 teachers 레코드 없음 → null
 * - handle_new_user() 트리거가 가입 시점에 행을 만들어주므로 정상 흐름에서는 항상 존재
 */
export async function getTeacherWithRole(
  supabase: SupabaseClient
): Promise<Teacher | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error || !data) return null
  return data as Teacher
}

export function isAdmin(teacher: Teacher | null): boolean {
  return teacher?.role === 'admin' || teacher?.role === 'superadmin'
}
