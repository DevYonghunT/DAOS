import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'

export const runtime = 'nodejs'

/** GET /api/admin/audit?action=role_change&limit=50 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher || !isAdmin(teacher)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)

  let query = supabase
    .from('audit_logs')
    .select('id, actor_id, action, target_type, target_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (action) query = query.eq('action', action)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // actor 이름 매핑
  const actorIds = Array.from(new Set((data ?? []).map((l) => l.actor_id)))
  const actorMap = new Map<string, string>()
  if (actorIds.length > 0) {
    const { data: actors } = await supabase
      .from('teachers')
      .select('id, name')
      .in('id', actorIds)
    for (const a of actors ?? []) actorMap.set(a.id, a.name)
  }

  const enriched = (data ?? []).map((l) => ({
    ...l,
    actor_name: actorMap.get(l.actor_id) ?? '알 수 없음',
  }))

  return NextResponse.json({ logs: enriched })
}
