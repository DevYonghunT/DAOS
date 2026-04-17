import type { SupabaseClient } from '@supabase/supabase-js'
import type { Teacher } from './teacher'

export type StudentProfile = {
  id: string
  student_number: string
  name: string
  auth_user_id: string | null
  password_changed: boolean
  is_active: boolean
}

export type UserContext =
  | { type: 'teacher'; profile: Teacher }
  | { type: 'student'; profile: StudentProfile }
  | null

/**
 * 현재 로그인된 사용자가 교사인지 학생인지 판별.
 *
 * 판별 순서:
 *  1. auth.getUser()로 인증 확인
 *  2. teachers 테이블에서 auth_user_id 매칭 → 교사
 *  3. student_profiles 테이블에서 auth_user_id 매칭 → 학생
 *  4. 둘 다 아니면 null
 */
export async function getCurrentUserContext(
  supabase: SupabaseClient
): Promise<UserContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // 교사 확인
  const { data: teacher } = await supabase
    .from('teachers')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (teacher) return { type: 'teacher', profile: teacher as Teacher }

  // 학생 확인
  const { data: student } = await supabase
    .from('student_profiles')
    .select('id, student_number, name, auth_user_id, password_changed, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (student) return { type: 'student', profile: student as StudentProfile }

  return null
}

export function isTeacher(ctx: UserContext): ctx is { type: 'teacher'; profile: Teacher } {
  return ctx?.type === 'teacher'
}

export function isStudent(ctx: UserContext): ctx is { type: 'student'; profile: StudentProfile } {
  return ctx?.type === 'student'
}

/**
 * 이메일 패턴으로 빠르게 사용자 유형 추정 (DB 조회 없이).
 * middleware 등 경량 판별에 사용.
 */
export function guessUserType(email: string | null | undefined): 'teacher' | 'student' | 'unknown' {
  if (!email) return 'unknown'
  if (email.startsWith('s') && email.endsWith('@deoksu.local')) return 'student'
  if (email.startsWith('t') && email.endsWith('@deoksu.local')) return 'teacher'
  // 실제 이메일 (Google SSO) → 교사
  if (email.includes('@') && !email.endsWith('@deoksu.local')) return 'teacher'
  return 'unknown'
}
