import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserContext } from '@/lib/auth/context'
import { isTeacher, isStudent } from '@/lib/auth/context'

/**
 * 현재 사용자가 해당 방의 멤버인지 확인.
 * 교사: 생성자이거나 room_members에 존재
 * 학생: room_members에 존재
 *
 * RLS가 1차 방어지만, API 레벨에서도 명시적 검증.
 */
export async function verifyRoomMember(
  supabase: SupabaseClient,
  roomId: string,
  ctx: UserContext
): Promise<boolean> {
  if (!ctx) return false

  if (isTeacher(ctx)) {
    // 생성자이거나 멤버
    const { data: room } = await supabase
      .from('rooms')
      .select('created_by')
      .eq('id', roomId)
      .maybeSingle()
    if (room?.created_by === ctx.profile.id) return true

    const { data: member } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('teacher_id', ctx.profile.id)
      .eq('is_active', true)
      .maybeSingle()
    return !!member
  }

  if (isStudent(ctx)) {
    const { data: member } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('student_id', ctx.profile.id)
      .eq('is_active', true)
      .maybeSingle()
    return !!member
  }

  return false
}

/**
 * 현재 사용자가 해당 방의 생성자(교사)인지 확인.
 */
export async function verifyRoomOwner(
  supabase: SupabaseClient,
  roomId: string,
  ctx: UserContext
): Promise<boolean> {
  if (!ctx || !isTeacher(ctx)) return false
  const { data: room } = await supabase
    .from('rooms')
    .select('created_by')
    .eq('id', roomId)
    .maybeSingle()
  return room?.created_by === ctx.profile.id
}
