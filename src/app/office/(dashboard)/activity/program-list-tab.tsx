'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProgramDialog } from './program-dialog'
import { ProgramDetailDialog } from './program-detail'
import { findCategory } from '@/lib/activity/categories'
import type { ProgramWithMeta } from '@/types/activity'
import { cn } from '@/lib/utils'

type Props = {
  academicYear: number
  canManage: boolean
  selfTeacherId: string
}

export function ProgramListTab({
  academicYear,
  canManage,
  selfTeacherId,
}: Props) {
  const [programs, setPrograms] = useState<ProgramWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ year: String(academicYear) })
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (deptFilter !== 'all') params.set('department', deptFilter)
    if (query.trim()) params.set('q', query.trim())
    try {
      const res = await fetch(`/api/activity/programs?${params.toString()}`)
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as { programs: ProgramWithMeta[] }
      setPrograms(json.programs)
    } catch {
      /* 네트워크 실패 무시 */
    } finally {
      setLoading(false)
    }
  }, [academicYear, statusFilter, deptFilter, query])

  useEffect(() => {
    load()
  }, [load])

  const departments = useMemo(() => {
    const set = new Set<string>()
    for (const p of programs) set.add(p.department)
    return [...set].sort()
  }, [programs])

  return (
    <div className="space-y-4">
      {/* 필터 + 검색 + 생성 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="프로그램명 검색"
            className="h-9 pl-8 bg-[#F7F6F3] border-transparent focus-visible:border-[#3B82F6]"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="planned">예정</SelectItem>
            <SelectItem value="completed">완료</SelectItem>
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 부서</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-9 bg-[#3B82F6] hover:bg-[#2563EB]"
        >
          <Plus className="h-4 w-4 mr-1" />새 프로그램
        </Button>
      </div>

      {/* 테이블 */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F6F3]">
            <tr className="text-left text-[11px] uppercase tracking-wider text-[#64748B]">
              <th className="px-4 py-3">일자</th>
              <th className="px-4 py-3">부서</th>
              <th className="px-4 py-3">프로그램명</th>
              <th className="px-4 py-3">기재 항목</th>
              <th className="px-4 py-3 text-center">참가자</th>
              <th className="px-4 py-3 text-center">상태</th>
              <th className="px-4 py-3">담당자</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && programs.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-10 text-center text-[#64748B]"
                >
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  불러오는 중…
                </td>
              </tr>
            )}
            {!loading && programs.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-10 text-center text-sm text-[#64748B]"
                >
                  등록된 프로그램이 없습니다.
                </td>
              </tr>
            )}
            {programs.map((p) => (
              <tr
                key={p.id}
                onClick={() => setDetailId(p.id)}
                className="cursor-pointer hover:bg-[#F7F6F3]/60 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs">
                  {p.program_date}
                </td>
                <td className="px-4 py-3 text-[#475569]">{p.department}</td>
                <td className="px-4 py-3 font-medium text-[#1E293B]">
                  {p.program_name}
                </td>
                <td className="px-4 py-3 text-[#64748B] text-xs">
                  {findCategory(p.record_category)?.label ??
                    p.record_category ??
                    '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center justify-center rounded-full bg-[#EEF4FF] text-[#3B82F6] text-xs px-2 py-0.5 min-w-[32px]">
                    {p.participant_count ?? 0}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-normal text-[11px]',
                      p.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    )}
                  >
                    {p.status === 'completed' ? '완료' : '예정'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-[#64748B] text-xs">
                  {p.teacher_name ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ProgramDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        academicYear={academicYear}
        canDelete={false}
        onSaved={() => {
          load()
        }}
      />

      <ProgramDetailDialog
        open={detailId !== null}
        onOpenChange={(v) => {
          if (!v) setDetailId(null)
        }}
        programId={detailId}
        canManage={canManage}
        selfTeacherId={selfTeacherId}
        onChanged={load}
      />
    </div>
  )
}
