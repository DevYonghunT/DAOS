'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, UsersRound, FileText } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ByteMeter } from '@/components/activity/byte-meter'
import type { RecordCategoryKey } from '@/lib/activity/categories'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  studentId: string | null
  academicYear: number
}

type Entry = {
  program_id: string
  program_name: string
  program_date: string
  department: string
  template: string | null
  bytes: number
}

type SummarySection = {
  key: RecordCategoryKey | string
  label: string
  description: string
  limitBytes: number
  limitChars: number
  mode: 'yearly' | 'per_entry'
  color: string
  entries: Entry[]
  totalBytes: number
  entryCount: number
}

type DetailResponse = {
  student: {
    id: string
    student_number: string
    name: string
    academic_year: number
    grade: number | null
    class_number: number | null
    number_in_class: number | null
  }
  summary: SummarySection[]
}

export function StudentDetailDialog({
  open,
  onOpenChange,
  studentId,
  academicYear,
}: Props) {
  const [data, setData] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!studentId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/activity/students/${studentId}?academic_year=${academicYear}`
      )
      if (!res.ok) throw new Error('불러오기 실패')
      const json = (await res.json()) as DetailResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패')
    } finally {
      setLoading(false)
    }
  }, [studentId, academicYear])

  useEffect(() => {
    if (open && studentId) load()
    if (!open) setData(null)
  }, [open, studentId, load])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        {loading && !data && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[#3B82F6]" />
          </div>
        )}
        {error && !data && (
          <div className="p-6">
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          </div>
        )}
        {data && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
              <DialogTitle className="text-lg flex items-center gap-2">
                <span className="font-mono text-xs text-[#64748B] tracking-wider">
                  {data.student.student_number}
                </span>
                <span>{data.student.name}</span>
                {data.student.grade != null && (
                  <Badge
                    variant="outline"
                    className="bg-[#EEF4FF] text-[#3B82F6] border-[#3B82F6]/30"
                  >
                    {data.student.grade}-{data.student.class_number}-
                    {data.student.number_in_class ?? '?'}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {data.student.academic_year}학년도 기재 영역별 누적 현황 —
                특기사항 바이트 사용량과 참여 프로그램별 세특 예시.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-5 space-y-5">
              {data.summary.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-[#F7F6F3] py-8 text-center">
                  <p className="text-sm text-[#64748B]">
                    이 학생은 {data.student.academic_year}학년도에 아직 활동
                    참여 기록이 없습니다.
                  </p>
                </div>
              )}

              {data.summary.map((sec) => (
                <CategorySection key={sec.key} section={sec} />
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CategorySection({ section }: { section: SummarySection }) {
  const isOver =
    section.mode === 'yearly' && section.totalBytes > section.limitBytes
  const isPerEntry = section.mode === 'per_entry'

  return (
    <section
      className={cn(
        'rounded-xl border bg-white shadow-sm',
        isOver ? 'border-red-200' : 'border-slate-200'
      )}
    >
      <header className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#1E293B] flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-[#64748B]" />
            {section.label}
            {isOver && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5">
                <AlertTriangle className="h-3 w-3" />
                한도 초과
              </span>
            )}
          </h3>
          <p className="text-[11px] text-[#64748B] mt-0.5">
            {section.description}
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-[#EEF4FF] text-[#3B82F6] text-xs px-2.5 py-1 shrink-0">
          <UsersRound className="h-3 w-3" />
          {section.entryCount}건 참여
        </div>
      </header>

      {/* 누적 바이트 바 (yearly 모드만) */}
      {!isPerEntry && section.entryCount > 0 && (
        <div className="px-4 pt-3">
          <ByteMeter
            used={section.totalBytes}
            limit={section.limitBytes}
            caption="연간 누적 바이트"
          />
        </div>
      )}

      {/* 참여 세부 내역 */}
      {section.entries.length === 0 ? (
        <p className="px-4 py-4 text-xs text-[#64748B]">
          이 영역 활동 참여가 아직 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {section.entries.map((ent) => (
            <li key={ent.program_id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#1E293B] truncate">
                    {ent.program_name}
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    {ent.program_date} · {ent.department}
                  </p>
                </div>
                <span
                  className={cn(
                    'text-[11px] tabular-nums shrink-0 rounded-md px-2 py-0.5',
                    isPerEntry && ent.bytes > section.limitBytes
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-slate-100 text-[#475569]'
                  )}
                >
                  {ent.bytes.toLocaleString()} B
                  {isPerEntry && ` / ${section.limitBytes} B`}
                </span>
              </div>
              {ent.template ? (
                <p className="text-xs text-[#475569] bg-[#F7F6F3] rounded px-3 py-2 whitespace-pre-wrap leading-relaxed">
                  {ent.template}
                </p>
              ) : (
                <p className="text-[11px] text-[#94A3B8] italic">
                  세특 템플릿 미지정
                </p>
              )}
              {isPerEntry && ent.bytes > section.limitBytes && (
                <p className="text-[11px] text-red-700 mt-1">
                  실적별 한도 ({section.limitBytes}B) 초과
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
