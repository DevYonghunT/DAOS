'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Loader2, Trash2, Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ByteMeter } from '@/components/activity/byte-meter'
import {
  allCategoriesSorted,
  categoriesForGrade,
  findCategory,
  type RecordCategoryKey,
} from '@/lib/activity/categories'
import { countNeisBytes } from '@/lib/activity/neis-bytes'
import type { ProgramRecord, ProgramStatus } from '@/types/activity'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: 'create' | 'edit'
  academicYear: number
  initial?: ProgramRecord | null
  canDelete: boolean
  onSaved: (programId: string) => void
}

type FormState = {
  academic_year: number
  department: string
  program_date: string
  program_name: string
  setuk_template: string
  record_category: RecordCategoryKey | ''
  target_grade: string // '', '1', '2', '3', '전학년'
  status: ProgramStatus
}

function emptyState(year: number): FormState {
  const today = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    academic_year: year,
    department: '',
    program_date: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
    program_name: '',
    setuk_template: '',
    record_category: '',
    target_grade: '',
    status: 'planned',
  }
}

function programToForm(p: ProgramRecord): FormState {
  return {
    academic_year: p.academic_year,
    department: p.department,
    program_date: p.program_date.slice(0, 10),
    program_name: p.program_name,
    setuk_template: p.setuk_template ?? '',
    record_category: (p.record_category as RecordCategoryKey) ?? '',
    target_grade: p.target_grade ?? '',
    status: p.status,
  }
}

export function ProgramDialog({
  open,
  onOpenChange,
  mode,
  academicYear,
  initial,
  canDelete,
  onSaved,
}: Props) {
  const [state, setState] = useState<FormState>(() =>
    initial ? programToForm(initial) : emptyState(academicYear)
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setState(initial ? programToForm(initial) : emptyState(academicYear))
  }, [open, initial, academicYear])

  // 대상 학년에 따라 노출할 카테고리
  const availableCategories = useMemo(() => {
    if (!state.target_grade || state.target_grade === '전학년') {
      return allCategoriesSorted()
    }
    const grade = Number(state.target_grade)
    if (!isFinite(grade)) return allCategoriesSorted()
    return categoriesForGrade(grade)
  }, [state.target_grade])

  // 선택된 카테고리의 메타정보
  const selectedCategory = findCategory(state.record_category)
  const byteLimit = selectedCategory?.limitBytes ?? 0

  // 실시간 NEIS 바이트 카운터
  const neisBytes = countNeisBytes(state.setuk_template)

  // 학년이 바뀌어 현재 선택 카테고리가 불가해지면 리셋
  useEffect(() => {
    if (
      state.record_category &&
      !availableCategories.some((c) => c.key === state.record_category)
    ) {
      setState((s) => ({ ...s, record_category: '' }))
    }
  }, [availableCategories, state.record_category])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!state.department.trim() || !state.program_name.trim()) {
      setError('부서와 프로그램명은 필수입니다.')
      return
    }
    if (!state.record_category) {
      setError('기재 영역(학생부 기재 항목)을 선택해주세요.')
      return
    }
    if (byteLimit && neisBytes > byteLimit) {
      setError(
        `세특 템플릿이 ${neisBytes}B로 한도 ${byteLimit}B를 초과합니다.`
      )
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        academic_year: state.academic_year,
        department: state.department.trim(),
        program_date: state.program_date,
        program_name: state.program_name.trim(),
        setuk_template: state.setuk_template.trim() || null,
        record_category: state.record_category,
        target_grade: state.target_grade.trim() || null,
        status: state.status,
      }
      const url =
        mode === 'edit' && initial
          ? `/api/activity/programs/${initial.id}`
          : '/api/activity/programs'
      const res = await fetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message || j.error || '저장 실패')
      }
      const json = (await res.json()) as { program: { id: string } }
      onOpenChange(false)
      onSaved(json.program.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!initial) return
    if (!confirm('이 프로그램을 삭제할까요? 참가자 기록도 함께 제거됩니다.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/activity/programs/${initial.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message || j.error || '삭제 실패')
      }
      onOpenChange(false)
      onSaved('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="text-lg">
            {mode === 'edit' ? '프로그램 편집' : '새 프로그램'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            세특입력활동을 등록합니다. 기재 영역을 선택하면 해당 영역의 바이트 한도가 자동으로 적용됩니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="px-6 py-5 space-y-6">
          {/* 기본 정보 */}
          <section className="space-y-4">
            <SectionLabel>기본 정보</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>학년도</Label>
                <Input
                  type="number"
                  value={state.academic_year}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      academic_year: Number(e.target.value),
                    }))
                  }
                  min={2020}
                  max={2100}
                />
              </div>
              <div className="space-y-1.5">
                <Label>일자</Label>
                <Input
                  type="date"
                  value={state.program_date}
                  onChange={(e) =>
                    setState((s) => ({ ...s, program_date: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>프로그램명</Label>
              <Input
                value={state.program_name}
                onChange={(e) =>
                  setState((s) => ({ ...s, program_name: e.target.value }))
                }
                placeholder="예: 과학의 달 실험 경진대회"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>담당 부서</Label>
                <Input
                  value={state.department}
                  onChange={(e) =>
                    setState((s) => ({ ...s, department: e.target.value }))
                  }
                  placeholder="예: 과학과"
                />
              </div>
              <div className="space-y-1.5">
                <Label>대상 학년</Label>
                <Select
                  value={state.target_grade || '전학년'}
                  onValueChange={(v) =>
                    setState((s) => ({ ...s, target_grade: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="전학년">전학년</SelectItem>
                    <SelectItem value="1">1학년</SelectItem>
                    <SelectItem value="2">2학년</SelectItem>
                    <SelectItem value="3">3학년</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* 기재 영역 */}
          <section className="space-y-4 pt-2 border-t border-slate-100">
            <SectionLabel>학생부 기재 영역</SectionLabel>
            <div className="space-y-1.5">
              <Label>기재 영역 선택</Label>
              <Select
                value={state.record_category}
                onValueChange={(v) =>
                  setState((s) => ({
                    ...s,
                    record_category: v as RecordCategoryKey,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="기재 영역 선택..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      <span className="flex flex-col items-start">
                        <span className="text-sm">{c.label}</span>
                        <span className="text-[11px] text-[#64748B]">
                          {c.limitChars}자 · {c.limitBytes}B
                          {c.mode === 'per_entry' && ' (실적별)'}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCategory && (
                <p className="text-[11px] text-[#64748B] pt-1 inline-flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>
                    {selectedCategory.description} — 2026 기재요령 한도{' '}
                    <strong>{selectedCategory.limitChars}자</strong>(
                    {selectedCategory.limitBytes}B).
                    {selectedCategory.mode === 'per_entry'
                      ? ' 실적별 개별 한도 적용.'
                      : ' 학생별 학년도 누적 한도 적용.'}
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>세특 예시/템플릿</Label>
              <Textarea
                rows={5}
                value={state.setuk_template}
                onChange={(e) =>
                  setState((s) => ({ ...s, setuk_template: e.target.value }))
                }
                placeholder={
                  selectedCategory
                    ? `예시 템플릿을 입력하세요. 학생 참여 시 이 예시가 해당 학생의 ${selectedCategory.label}에 누적됩니다.`
                    : '먼저 기재 영역을 선택하세요.'
                }
                disabled={!selectedCategory}
              />
              {selectedCategory && (
                <ByteMeter
                  used={neisBytes}
                  limit={byteLimit}
                  size="sm"
                  caption={`NEIS 바이트 (${selectedCategory.label} 1회 한도)`}
                />
              )}
            </div>
          </section>

          {/* 상태 */}
          <section className="space-y-4 pt-2 border-t border-slate-100">
            <SectionLabel>상태</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>진행 상태</Label>
                <Select
                  value={state.status}
                  onValueChange={(v) =>
                    setState((s) => ({ ...s, status: v as ProgramStatus }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">예정</SelectItem>
                    <SelectItem value="completed">완료</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-2 pt-4 border-t border-slate-100">
            {mode === 'edit' && canDelete && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                disabled={deleting || saving}
                className="text-red-600 hover:bg-red-50 hover:text-red-700 mr-auto"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-1" />
                    삭제
                  </>
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#3B82F6] hover:bg-[#2563EB]"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-3">
      {children}
    </p>
  )
}
