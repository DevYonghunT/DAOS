'use client'

import { useState, type KeyboardEvent } from 'react'
import { Loader2, Sparkles, Users } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { ParsedCalendarEvent } from '@/lib/calendar/schema'
import type { AssigneeMatch, TeacherLite } from '@/types/calendar'

type Props = {
  onApply: (parsed: ParsedCalendarEvent, autoShareIds: string[]) => void
}

type ParseResponse = {
  parsed: ParsedCalendarEvent
  assignee_matches: AssigneeMatch[]
}

const EXAMPLES = [
  '내일 3교시 1학년 3반 수업 준비',
  '다음 주 금요일 오후 2시 학년 협의회',
  '4월 25일 하루종일 현장체험학습',
]

export function NlInput({ onApply }: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ParseResponse | null>(null)
  const [pickedShareIds, setPickedShareIds] = useState<Record<string, string>>({})

  const parse = async () => {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setPickedShareIds({})
    try {
      const res = await fetch('/api/calendar/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || body.error || '파싱 실패')
      }
      const json = (await res.json()) as ParseResponse
      setResult(json)
      // 명확한 단일 매치는 자동 선택
      const auto: Record<string, string> = {}
      for (const m of json.assignee_matches) {
        if (m.matches.length === 1) auto[m.query] = m.matches[0].id
      }
      setPickedShareIds(auto)
    } catch (err) {
      setError(err instanceof Error ? err.message : '파싱 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      parse()
    }
  }

  const applyToForm = () => {
    if (!result) return
    const ids = Object.values(pickedShareIds).filter(Boolean)
    onApply(result.parsed, ids)
  }

  return (
    <div className="space-y-3">
      <Textarea
        rows={3}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`자연어로 입력하세요. Cmd/Ctrl+Enter로 바로 파싱.\n예) ${EXAMPLES[0]}`}
        className="bg-[#F7F6F3] border-transparent focus-visible:border-[#3B82F6]"
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={parse}
          disabled={loading || !input.trim()}
          className="bg-[#3B82F6] hover:bg-[#2563EB] shrink-0"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          <span className="ml-1.5">AI로 파싱</span>
        </Button>
      </div>

      {!result && !loading && (
        <div>
          <p className="text-[11px] text-[#64748B] mb-1.5">예시</p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setInput(ex)}
                className="rounded-full bg-[#F7F6F3] px-2.5 py-1 text-[11px] text-[#475569] hover:bg-slate-200 transition"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-lg border border-slate-200 bg-[#F7F6F3] p-3 space-y-3">
          <div>
            <p className="text-xs text-[#64748B] mb-1">제목</p>
            <p className="text-sm font-medium text-[#1E293B]">
              {result.parsed.title}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[#64748B] mb-1">시작</p>
              <p className="text-sm text-[#1E293B]">
                {formatDate(result.parsed.start_date, result.parsed.all_day)}
              </p>
            </div>
            {result.parsed.end_date && (
              <div>
                <p className="text-xs text-[#64748B] mb-1">종료</p>
                <p className="text-sm text-[#1E293B]">
                  {formatDate(result.parsed.end_date, result.parsed.all_day)}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-[#64748B] mb-1">종류</p>
              <p className="text-sm text-[#1E293B]">
                {typeLabel(result.parsed.event_type)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#64748B] mb-1">종일</p>
              <p className="text-sm text-[#1E293B]">
                {result.parsed.all_day ? '예' : '아니오'}
              </p>
            </div>
          </div>

          {result.assignee_matches.length > 0 && (
            <div>
              <p className="text-xs text-[#64748B] mb-2 inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                공유 대상 후보
              </p>
              <div className="space-y-2">
                {result.assignee_matches.map((m) => (
                  <AssigneeRow
                    key={m.query}
                    match={m}
                    picked={pickedShareIds[m.query] ?? ''}
                    onPick={(id) =>
                      setPickedShareIds((prev) => ({
                        ...prev,
                        [m.query]: id,
                      }))
                    }
                  />
                ))}
              </div>
              {result.assignee_matches.every((m) => m.matches.length === 0) && (
                <p className="text-[11px] text-[#64748B] mt-2">
                  이름으로 찾지 못했다면, 다음 화면(상세 입력)의 &apos;공유 대상&apos;에서 직접 검색해 추가할 수 있어요.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              onClick={applyToForm}
              className="bg-[#06B6D4] hover:bg-[#0891B2] text-white"
            >
              이 내용으로 편집 계속
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function AssigneeRow({
  match,
  picked,
  onPick,
}: {
  match: AssigneeMatch
  picked: string
  onPick: (id: string) => void
}) {
  if (match.matches.length === 0) {
    return (
      <div className="rounded-md bg-white border border-dashed border-slate-300 px-3 py-2 text-xs text-[#64748B]">
        <span className="text-[#1E293B] font-medium">{match.query}</span> —
        일치하는 교사를 찾지 못했어요
      </div>
    )
  }
  return (
    <div className="rounded-md bg-white border border-slate-200 px-3 py-2">
      <p className="text-xs text-[#64748B] mb-1.5">
        입력:{' '}
        <span className="text-[#1E293B] font-medium">{match.query}</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {match.matches.map((t) => (
          <TeacherChip
            key={t.id}
            teacher={t}
            selected={picked === t.id}
            onSelect={() => onPick(t.id)}
          />
        ))}
      </div>
    </div>
  )
}

function TeacherChip({
  teacher,
  selected,
  onSelect,
}: {
  teacher: TeacherLite
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-full border px-2.5 py-1 text-xs transition ${
        selected
          ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
          : 'bg-white text-[#1E293B] border-slate-200 hover:border-[#3B82F6]/40'
      }`}
    >
      {teacher.name}
      {teacher.department && (
        <span className="ml-1 opacity-80">·{teacher.department}</span>
      )}
    </button>
  )
}

function formatDate(iso: string, allDay: boolean): string {
  const d = new Date(iso)
  const fmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    ...(allDay ? {} : { hour: '2-digit', minute: '2-digit', hour12: false }),
  })
  return fmt.format(d)
}

function typeLabel(t: ParsedCalendarEvent['event_type']): string {
  return t === 'school' ? '학교 전체' : t === 'shared' ? '공유' : '개인'
}
