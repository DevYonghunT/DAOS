'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Trash2, UsersRound } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StudentPicker, formatStudentLabel } from './student-picker'
import { ProgramDialog } from './program-dialog'
import { findCategory } from '@/lib/activity/categories'
import { countNeisBytes } from '@/lib/activity/neis-bytes'
import type {
  ParticipantRecord,
  ProgramRecord,
  StudentSearchResult,
} from '@/types/activity'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  programId: string | null
  canManage: boolean
  selfTeacherId: string
  onChanged: () => void
}

type DetailResponse = {
  program: ProgramRecord & { teacher_name?: string | null }
  participants: ParticipantRecord[]
}

export function ProgramDetailDialog({
  open,
  onOpenChange,
  programId,
  canManage,
  selfTeacherId,
  onChanged,
}: Props) {
  const [data, setData] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const load = useCallback(async () => {
    if (!programId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/activity/programs/${programId}`)
      if (!res.ok) throw new Error('불러오기 실패')
      const json = (await res.json()) as DetailResponse
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패')
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => {
    if (open && programId) load()
    if (!open) setData(null)
  }, [open, programId, load])

  const isOwner = data?.program.teacher_id === selfTeacherId
  const canEditDelete = canManage || isOwner

  const addStudents = async (students: StudentSearchResult[]) => {
    if (!programId) return
    try {
      const res = await fetch(
        `/api/activity/programs/${programId}/participants`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_ids: students.map((s) => s.id),
          }),
        }
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message || j.error || '추가 실패')
      }
      await load()
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : '추가 실패')
    }
  }

  const removeStudent = async (studentId: string, name: string) => {
    if (!programId) return
    if (!confirm(`${name} 학생을 명단에서 제거할까요?`)) return
    try {
      const res = await fetch(
        `/api/activity/programs/${programId}/participants?student_id=${studentId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message || j.error || '제거 실패')
      }
      await load()
      onChanged()
    } catch (e) {
      alert(e instanceof Error ? e.message : '제거 실패')
    }
  }

  return (
    <>
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
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-lg flex items-center gap-2 flex-wrap">
                      <span className="truncate">
                        {data.program.program_name}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          data.program.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }
                      >
                        {data.program.status === 'completed' ? '완료' : '예정'}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-1">
                      {data.program.department} · {data.program.program_date} ·{' '}
                      {data.program.academic_year}학년도
                      {data.program.teacher_name &&
                        ` · 담당 ${data.program.teacher_name}`}
                    </DialogDescription>
                  </div>
                  {canEditDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditOpen(true)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      편집
                    </Button>
                  )}
                </div>
              </DialogHeader>

              <div className="px-6 py-5 space-y-5">
                {/* 프로그램 정보 */}
                {(data.program.record_category ||
                  data.program.target_grade ||
                  data.program.setuk_template) && (
                  <section className="rounded-lg border border-slate-200 bg-[#F7F6F3] p-4 space-y-2">
                    {data.program.record_category && (
                      <InfoRow
                        label="기재 영역"
                        value={
                          findCategory(data.program.record_category)?.label ??
                          data.program.record_category
                        }
                      />
                    )}
                    {data.program.target_grade && (
                      <InfoRow
                        label="대상 학년"
                        value={data.program.target_grade}
                      />
                    )}
                    {data.program.setuk_template && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1">
                          세특 템플릿 ·{' '}
                          {countNeisBytes(
                            data.program.setuk_template
                          ).toLocaleString()}
                          /{data.program.byte_limit.toLocaleString()} B
                        </p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed text-[#1E293B]">
                          {data.program.setuk_template}
                        </p>
                      </div>
                    )}
                  </section>
                )}

                {/* 참가자 */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#1E293B] inline-flex items-center gap-1.5">
                      <UsersRound className="h-4 w-4 text-[#3B82F6]" />
                      참가 학생 ({data.participants.length}명)
                    </h3>
                  </div>

                  {canEditDelete && (
                    <StudentPicker
                      academicYear={data.program.academic_year}
                      excludeIds={data.participants.map((p) => p.student_id)}
                      onAdd={addStudents}
                    />
                  )}

                  {data.participants.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-[#F7F6F3] py-6 px-4 text-center text-xs text-[#64748B]">
                      아직 참가 학생이 없습니다. 위에서 검색해 추가하세요.
                    </p>
                  ) : (
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-[#F7F6F3]">
                          <tr className="text-left text-[11px] uppercase tracking-wider text-[#64748B]">
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">학번</th>
                            <th className="px-3 py-2">이름</th>
                            <th className="px-3 py-2">학년·반·번호</th>
                            {canEditDelete && (
                              <th className="px-3 py-2 text-right">액션</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.participants.map((p, idx) => {
                            const s = p.student
                            const name = s
                              ? (s as { name: string }).name
                              : '알 수 없음'
                            return (
                              <tr
                                key={p.id}
                                className="hover:bg-[#F7F6F3]/60"
                              >
                                <td className="px-3 py-2 text-[#64748B] text-xs">
                                  {idx + 1}
                                </td>
                                <td className="px-3 py-2 font-mono text-xs">
                                  {s
                                    ? (s as { student_number: string })
                                        .student_number
                                    : '-'}
                                </td>
                                <td className="px-3 py-2 font-medium text-[#1E293B]">
                                  {name}
                                </td>
                                <td className="px-3 py-2 text-[#475569] text-xs">
                                  {s &&
                                  (s as { grade: number | null }).grade !=
                                    null
                                    ? `${(s as { grade: number }).grade}-${
                                        (s as { class_number: number })
                                          .class_number
                                      }-${
                                        (s as { number_in_class: number | null })
                                          .number_in_class ?? '?'
                                      }`
                                    : '-'}
                                </td>
                                {canEditDelete && (
                                  <td className="px-3 py-2 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        removeStudent(p.student_id, name)
                                      }
                                      className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 편집 다이얼로그 */}
      {data && (
        <ProgramDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          mode="edit"
          academicYear={data.program.academic_year}
          initial={data.program}
          canDelete={canEditDelete}
          onSaved={(id) => {
            if (!id) {
              // 삭제된 경우
              onOpenChange(false)
            } else {
              load()
            }
            onChanged()
          }}
        />
      )}
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-2 text-sm">
      <span className="text-[#64748B] text-xs pt-0.5">{label}</span>
      <span className="text-[#1E293B]">{value}</span>
    </div>
  )
}

// 사용 안 하지만 export 유지 (다른 곳에서 재사용 가능)
export const _labelHelper = formatStudentLabel
