'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Search, X, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { TeacherLite } from '@/types/calendar'

type Props = {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  excludeId?: string
}

export function TeacherPicker({ selectedIds, onChange, excludeId }: Props) {
  const [teachers, setTeachers] = useState<TeacherLite[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('teachers')
        .select('id, name, email, department, subject')
        .eq('is_active', true)
        .order('name', { ascending: true })
      if (!active) return
      setTeachers((data ?? []) as TeacherLite[])
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return teachers
      .filter((t) => t.id !== excludeId)
      .filter((t) => {
        if (!normalized) return true
        const haystack = [t.name, t.department, t.subject, t.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(normalized)
      })
  }, [teachers, query, excludeId])

  const selectedMap = useMemo(() => new Set(selectedIds), [selectedIds])

  const toggle = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  const selectedTeachers = teachers.filter((t) => selectedMap.has(t.id))
  const totalOthers = teachers.filter((t) => t.id !== excludeId).length

  // 다른 교사가 아직 아무도 가입하지 않은 경우
  if (!loading && totalOthers === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-[#F7F6F3] p-4 text-center">
        <Users className="h-5 w-5 text-[#94A3B8] mx-auto mb-2" />
        <p className="text-xs text-[#475569] font-medium mb-1">
          아직 다른 교사가 가입하지 않았습니다
        </p>
        <p className="text-[11px] text-[#64748B]">
          다른 선생님이 Google 계정으로 로그인하면 자동으로 여기에 표시됩니다.
          그 전까진 &apos;개인&apos; 일정으로 저장하세요.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* 선택된 칩 */}
      {selectedTeachers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 border-b border-slate-200">
          {selectedTeachers.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className="inline-flex items-center gap-1 rounded-full bg-[#EEF4FF] text-[#3B82F6] text-xs px-2.5 py-1 hover:bg-[#DDE8FF]"
            >
              {t.name}
              {t.department && (
                <span className="text-[10px] opacity-70">·{t.department}</span>
              )}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {/* 검색 */}
      <div className="relative p-2 border-b border-slate-200">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`교사 이름·부서 검색 (등록 ${totalOthers}명)`}
          className="h-9 pl-8 bg-[#F7F6F3] border-transparent focus-visible:border-[#3B82F6]"
        />
      </div>

      {/* 리스트 */}
      <div className="max-h-56 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-xs text-[#64748B]">불러오는 중…</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-xs text-[#64748B]">검색 결과가 없습니다.</p>
        ) : (
          <ul>
            {filtered.map((t) => {
              const isSelected = selectedMap.has(t.id)
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => toggle(t.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[#F7F6F3]',
                      isSelected && 'bg-[#EEF4FF]/50'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded border',
                        isSelected
                          ? 'bg-[#3B82F6] border-[#3B82F6] text-white'
                          : 'border-slate-300'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[#1E293B] truncate">
                        {t.name}
                      </span>
                      <span className="block text-[11px] text-[#64748B] truncate">
                        {[t.department, t.subject].filter(Boolean).join(' · ') ||
                          t.email}
                      </span>
                    </span>
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
