'use client'

import { useCallback, useEffect, useState } from 'react'
import { BarChart3, Loader2, RefreshCw, Zap, DollarSign, Clock, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Summary = {
  total_requests: number
  total_tokens_input: number
  total_tokens_output: number
  total_cost_usd: number
  cache_hit_rate: number
  error_rate: number
  avg_latency_ms: number
}

type ByFeature = Record<string, { requests: number; cost: number; tokens: number }>
type ByTeacher = Array<{ name: string; requests: number; cost: number }>

type UsageData = {
  period: string
  summary: Summary
  by_feature: ByFeature
  by_teacher: ByTeacher
}

const PERIODS = [
  { value: '7d', label: '최근 7일' },
  { value: '30d', label: '최근 30일' },
  { value: '90d', label: '최근 90일' },
]

const FEATURE_LABELS: Record<string, string> = {
  chat: 'AI 어시스턴트',
  calendar: '캘린더',
  setuk: '세특 작성',
  review: '학생부 검수',
  rules: '학교 규정',
  consult: '상담 기록',
  activity: '세특입력활동',
}

export default function AdminUsagePage() {
  const [period, setPeriod] = useState('7d')
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/usage?period=${period}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [period])

  useEffect(() => { load() }, [load])

  const s = data?.summary

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-6xl mx-auto px-8 py-8">
        <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-[#1E293B]">사용량 통계</h1>
            <p className="text-sm text-[#64748B] mt-1">
              AI 호출 횟수, 토큰 사용량, 비용, 캐시 효율을 모니터링합니다.
            </p>
          </div>
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <Button
                key={p.value}
                variant={period === p.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p.value)}
                className={period === p.value ? 'bg-[#3B82F6]' : ''}
              >
                {p.label}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>
          </div>
        </header>

        {loading && !data && (
          <div className="py-20 text-center text-[#64748B]">
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
            통계 집계 중…
          </div>
        )}

        {s && (
          <>
            {/* 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard icon={<Zap className="h-4 w-4" />} label="총 요청" value={`${s.total_requests}회`} />
              <StatCard icon={<DollarSign className="h-4 w-4" />} label="총 비용" value={`$${s.total_cost_usd.toFixed(4)}`} accent />
              <StatCard icon={<Clock className="h-4 w-4" />} label="평균 응답" value={`${s.avg_latency_ms}ms`} />
              <StatCard icon={<Shield className="h-4 w-4" />} label="캐시 적중" value={`${s.cache_hit_rate}%`} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="입력 토큰" value={s.total_tokens_input.toLocaleString()} sub />
              <StatCard label="출력 토큰" value={s.total_tokens_output.toLocaleString()} sub />
              <StatCard label="에러율" value={`${s.error_rate}%`} sub danger={s.error_rate > 10} />
              <StatCard label="기간" value={data.period} sub />
            </div>

            {/* 기능별 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
                <h2 className="text-sm font-semibold text-[#1E293B] mb-4 inline-flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-[#3B82F6]" />
                  기능별 사용량
                </h2>
                <div className="space-y-3">
                  {Object.entries(data.by_feature).map(([key, val]) => {
                    const maxReq = Math.max(...Object.values(data.by_feature).map((v) => v.requests), 1)
                    const pct = (val.requests / maxReq) * 100
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[#1E293B] font-medium">
                            {FEATURE_LABELS[key] ?? key}
                          </span>
                          <span className="text-[#64748B] tabular-nums">
                            {val.requests}회 · ${val.cost.toFixed(4)}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#3B82F6] rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  {Object.keys(data.by_feature).length === 0 && (
                    <p className="text-xs text-[#64748B]">데이터 없음</p>
                  )}
                </div>
              </section>

              {/* 교사별 */}
              <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
                <h2 className="text-sm font-semibold text-[#1E293B] mb-4">
                  교사별 사용량 (비용 순)
                </h2>
                {data.by_teacher.length === 0 ? (
                  <p className="text-xs text-[#64748B]">데이터 없음</p>
                ) : (
                  <div className="space-y-2">
                    {data.by_teacher.slice(0, 15).map((t, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-1">
                        <span className="text-[#1E293B]">{t.name}</span>
                        <span className="text-[#64748B] tabular-nums">
                          {t.requests}회 · ${t.cost.toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  accent,
  sub,
  danger,
}: {
  icon?: React.ReactNode
  label: string
  value: string
  accent?: boolean
  sub?: boolean
  danger?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-4 shadow-sm',
        accent && 'border-[#3B82F6]/30 bg-[#EEF4FF]/30',
        danger && 'border-red-200 bg-red-50/30',
        sub && 'border-slate-200'
      )}
    >
      {icon && <div className="text-[#3B82F6] mb-1">{icon}</div>}
      <p className={cn('text-[11px] text-[#64748B]', sub && 'mb-0')}>{label}</p>
      <p className={cn('font-bold tabular-nums', sub ? 'text-base text-[#1E293B]' : 'text-xl text-[#1E293B]')}>
        {value}
      </p>
    </div>
  )
}
