'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { StudentSearchResult } from '@/types/activity'
import { cn } from '@/lib/utils'

type Props = {
  academicYear: number
  excludeIds?: string[]
  onAdd: (students: StudentSearchResult[]) => void
}

/**
 * 학생 자동완성 + 다중 선택 → 일괄 추가
 *
 * - 학번 숫자 입력: student_number prefix ilike
 * - 이름 입력: name ilike
 * - 선택된 학생들을 모아서 onAdd로 넘김
 */
export function StudentPicker({ academicYear, excludeIds = [], onAdd }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StudentSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<StudentSearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setError(null)
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/activity/students/search?q=${encodeURIComponent(query)}&academic_year=${academicYear}`,
          { signal: ctrl.signal }
        )
        if (!res.ok) throw new Error('검색 실패')
        const json = (await res.json()) as { students: StudentSearchResult[] }
        setResults(json.students)
        setError(null)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setError(e instanceof Error ? e.message : '검색 실패')
        }
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query, academicYear])

  const excluded = new Set([...excludeIds, ...picked.map((s) => s.id)])
  const filtered = results.filter((s) => !excluded.has(s.id))

  const togglePick = (s: StudentSearchResult) => {
    setPicked((prev) =>
      prev.some((p) => p.id === s.id)
        ? prev.filter((p) => p.id !== s.id)
        : [...prev, s]
    )
  }

  const removePick = (id: string) => {
    setPicked((prev) => prev.filter((p) => p.id !== id))
  }

  const doAdd = () => {
    if (picked.length === 0) return
    onAdd(picked)
    setPicked([])
    setQuery('')
    setResults([])
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* 선택 목록 */}
      {picked.length > 0 && (
        <div className="p-2 border-b border-slate-200 flex flex-wrap gap-1.5">
          {picked.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => removePick(s.id)}
              className="inline-flex items-center gap-1 rounded-full bg-[#EEF4FF] text-[#3B82F6] text-xs px-2.5 py-1 hover:bg-[#DDE8FF]"
            >
              {formatStudentLabel(s)}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {/* 검색창 */}
      <div className="relative p-2 border-b border-slate-200 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="학번 또는 이름으로 검색 (예: 20260101 또는 김)"
            className="h-9 pl-8 bg-[#F7F6F3] border-transparent focus-visible:border-[#3B82F6]"
          />
        </div>
        <Button
          type="button"
          onClick={doAdd}
          disabled={picked.length === 0}
          className="h-9 bg-[#3B82F6] hover:bg-[#2563EB]"
        >
          <UserPlus className="h-4 w-4 mr-1" />
          추가 ({picked.length})
        </Button>
      </div>

      {/* 결과 */}
      <div className="max-h-60 overflow-y-auto">
        {loading && (
          <div className="p-4 flex items-center gap-2 text-xs text-[#64748B]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            검색 중…
          </div>
        )}
        {!loading && query && filtered.length === 0 && (
          <p className="p-4 text-xs text-[#64748B]">
            {error
              ? error
              : '일치하는 학생이 없습니다. 학번 또는 이름을 정확히 입력해보세요.'}
          </p>
        )}
        {!loading && !query && (
          <p className="p-4 text-xs text-[#64748B]">
            학번 또는 이름 일부를 입력하면 검색됩니다.
          </p>
        )}
        {!loading && filtered.length > 0 && (
          <ul>
            {filtered.map((s) => {
              const isPicked = picked.some((p) => p.id === s.id)
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => togglePick(s)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[#F7F6F3] transition',
                      isPicked && 'bg-[#EEF4FF]/50'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[#1E293B]">
                        <span className="font-mono text-xs text-[#64748B]">
                          {s.student_number}
                        </span>{' '}
                        <span className="font-medium">{s.name}</span>
                      </p>
                      <p className="text-[11px] text-[#64748B]">
                        {s.grade != null
                          ? `${s.grade}-${s.class_number}-${s.number_in_class ?? '?'} (${s.academic_year}학년도)`
                          : '해당 학년도 소속 정보 없음'}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export function formatStudentLabel(s: StudentSearchResult): string {
  if (s.grade != null && s.class_number != null) {
    return `${s.student_number} ${s.name} (${s.grade}-${s.class_number}-${s.number_in_class ?? '?'})`
  }
  return `${s.student_number} ${s.name}`
}
