import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'

export const runtime = 'nodejs'

/**
 * GET /api/admin/usage?period=7d
 *
 * 관리자 사용량 통계:
 *  - 기간별 총 토큰/비용
 *  - 기능별/모델별 사용량
 *  - 캐시 적중률
 *  - 교사별 사용량 (이름만, 대화 내용 접근 불가)
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher || !isAdmin(teacher)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const period = url.searchParams.get('period') ?? '7d'
  const days = period === '30d' ? 30 : period === '90d' ? 90 : 7
  const since = new Date(Date.now() - days * 86400000).toISOString()

  // usage_logs 집계
  const { data: usageLogs } = await supabase
    .from('usage_logs')
    .select('teacher_id, feature, model, tokens_input, tokens_output, cost_usd, created_at')
    .gte('created_at', since)

  // ai_requests 집계 (캐시 + 에러)
  const { data: aiReqs } = await supabase
    .from('ai_requests')
    .select('feature, model, status, cache_hit, latency_ms, created_at')
    .gte('created_at', since)

  // 교사 이름 매핑
  const teacherIds = Array.from(new Set((usageLogs ?? []).map((l) => l.teacher_id)))
  const teacherMap = new Map<string, string>()
  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id, name')
      .in('id', teacherIds)
    for (const t of teachers ?? []) teacherMap.set(t.id, t.name)
  }

  // 총합
  const logs = usageLogs ?? []
  const reqs = aiReqs ?? []
  const totalIn = logs.reduce((a, l) => a + (l.tokens_input ?? 0), 0)
  const totalOut = logs.reduce((a, l) => a + (l.tokens_output ?? 0), 0)
  const totalCost = logs.reduce((a, l) => a + Number(l.cost_usd ?? 0), 0)
  const totalRequests = reqs.length
  const cacheHits = reqs.filter((r) => r.cache_hit).length
  const errorCount = reqs.filter((r) => r.status === 'error').length
  const avgLatency = reqs.length > 0
    ? Math.round(reqs.reduce((a, r) => a + (r.latency_ms ?? 0), 0) / reqs.length)
    : 0

  // 기능별
  const byFeature = new Map<string, { requests: number; cost: number; tokens: number }>()
  for (const l of logs) {
    const f = byFeature.get(l.feature) ?? { requests: 0, cost: 0, tokens: 0 }
    f.requests++
    f.cost += Number(l.cost_usd ?? 0)
    f.tokens += (l.tokens_input ?? 0) + (l.tokens_output ?? 0)
    byFeature.set(l.feature, f)
  }

  // 교사별
  const byTeacher = new Map<string, { name: string; requests: number; cost: number }>()
  for (const l of logs) {
    const name = teacherMap.get(l.teacher_id) ?? '알 수 없음'
    const t = byTeacher.get(l.teacher_id) ?? { name, requests: 0, cost: 0 }
    t.requests++
    t.cost += Number(l.cost_usd ?? 0)
    byTeacher.set(l.teacher_id, t)
  }

  return NextResponse.json({
    period: `${days}d`,
    summary: {
      total_requests: totalRequests,
      total_tokens_input: totalIn,
      total_tokens_output: totalOut,
      total_cost_usd: Math.round(totalCost * 1000000) / 1000000,
      cache_hit_rate: totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0,
      error_rate: totalRequests > 0 ? Math.round((errorCount / totalRequests) * 100) : 0,
      avg_latency_ms: avgLatency,
    },
    by_feature: Object.fromEntries(byFeature),
    by_teacher: Array.from(byTeacher.values())
      .sort((a, b) => b.cost - a.cost),
  })
}
