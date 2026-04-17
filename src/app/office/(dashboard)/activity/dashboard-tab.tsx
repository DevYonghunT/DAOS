'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Loader2, Sparkles, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StudentDetailDialog } from './student-detail'
import type { ParticipationSummaryRow } from '@/types/activity'
import { cn } from '@/lib/utils'

type Props = {
  academicYear: number
}

type SortKey = 'participations' | 'class' | 'name'

export function DashboardTab({ academicYear }: Props) {
  const [grade, setGrade] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('participations')
  const [rows, setRows] = useState<ParticipationSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      academic_year: String(academicYear),
      sort,
      dir: 'desc',
    })
    if (grade !== 'all') params.set('grade', grade)
    try {
      const res = await fetch(`/api/activity/summary?${params.toString()}`)
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as { rows: ParticipationSummaryRow[] }
      setRows(json.rows)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [academicYear, grade, sort])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    if (rows.length === 0) {
      return { total: 0, avg: 0, max: 0, topCount: 0 }
    }
    const sum = rows.reduce((acc, r) => acc + (r.total_participations ?? 0), 0)
    const max = rows.reduce(
      (m, r) => Math.max(m, r.total_participations ?? 0),
      0
    )
    const topCount = rows.filter(
      (r) => (r.participation_percentile ?? 1) <= 0.05
    ).length
    return {
      total: rows.length,
      avg: rows.length > 0 ? Math.round((sum / rows.length) * 10) / 10 : 0,
      max,
      topCount,
    }
  }, [rows])

  const exportCsv = () => {
    const header = [
      '학번',
      '이름',
      '학년',
      '반',
      '번호',
      '참여 횟수',
      '백분위',
      '참여 부서',
    ]
    const lines = rows.map((r) => [
      r.student_number,
      r.name,
      r.grade,
      r.class_number,
      r.number_in_class ?? '',
      r.total_participations,
      ((1 - (r.participation_percentile ?? 1)) * 100).toFixed(1),
      (r.departments ?? []).join(' / '),
    ])
    const csv = [header, ...lines]
      .map((row) =>
        row
          .map((v) => {
            const s = String(v ?? '')
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
          })
          .join(',')
      )
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `participation_${academicYear}${grade !== 'all' ? `_${grade}학년` : ''}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 학년</SelectItem>
            <SelectItem value="1">1학년</SelectItem>
            <SelectItem value="2">2학년</SelectItem>
            <SelectItem value="3">3학년</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="participations">참여 횟수 많은 순</SelectItem>
            <SelectItem value="class">학년·반·번호 순</SelectItem>
            <SelectItem value="name">이름 순</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="h-9"
        >
          <Download className="h-4 w-4 mr-1" />
          CSV 내보내기
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="학생 수" value={`${stats.total}명`} />
        <StatCard label="평균 참여" value={`${stats.avg}회`} />
        <StatCard label="최다 참여" value={`${stats.max}회`} />
        <StatCard
          label="상위 5%"
          value={`${stats.topCount}명`}
          accent="amber"
        />
      </div>

      {/* 테이블 */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F6F3]">
            <tr className="text-left text-[11px] uppercase tracking-wider text-[#64748B]">
              <th className="px-4 py-3">학번</th>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">학년·반·번호</th>
              <th className="px-4 py-3 text-center">참여</th>
              <th className="px-4 py-3">참여 부서</th>
              <th className="px-4 py-3 text-center">상위</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center text-sm text-[#64748B]"
                >
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  집계 중…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center text-sm text-[#64748B]"
                >
                  해당 조건의 학생 참여 데이터가 없습니다.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const isTop =
                (r.participation_percentile ?? 1) <= 0.05 &&
                r.total_participations > 0
              return (
                <tr
                  key={r.student_id}
                  onClick={() => setDetailStudentId(r.student_id)}
                  className={cn(
                    'hover:bg-[#F7F6F3]/60 transition-colors cursor-pointer',
                    isTop && 'bg-amber-50/40'
                  )}
                >
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.student_number}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#1E293B]">
                    {r.name}
                  </td>
                  <td className="px-4 py-3 text-[#475569] text-xs">
                    {r.grade}-{r.class_number}-{r.number_in_class ?? '?'}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">
                    {r.total_participations}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">
                    {(r.departments ?? []).slice(0, 3).join(', ') || '-'}
                    {(r.departments?.length ?? 0) > 3 && (
                      <span> 외 {(r.departments?.length ?? 0) - 3}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex items-center gap-2">
                      {isTop && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-[11px] px-2 py-0.5">
                          <Sparkles className="h-3 w-3" />
                          5%
                        </span>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-[#94A3B8]" />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <StudentDetailDialog
        open={detailStudentId !== null}
        onOpenChange={(v) => {
          if (!v) setDetailStudentId(null)
        }}
        studentId={detailStudentId}
        academicYear={academicYear}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'amber'
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
        accent === 'amber' && 'bg-amber-50/40 border-amber-200'
      )}
    >
      <p className="text-xs text-[#64748B] mb-1">{label}</p>
      <p
        className={cn(
          'text-lg font-bold',
          accent === 'amber' ? 'text-amber-700' : 'text-[#1E293B]'
        )}
      >
        {value}
      </p>
    </div>
  )
}
