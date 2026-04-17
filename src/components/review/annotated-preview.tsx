'use client'

import { useMemo } from 'react'
import { dedupeOverlapping, type LocalViolation } from '@/lib/review/local-checks'
import { cn } from '@/lib/utils'

type Props = {
  text: string
  violations: LocalViolation[]
  className?: string
}

/**
 * 원문 텍스트를 위반 구간 하이라이트와 함께 렌더링.
 *  - error: 빨강 밑줄 + 빨강 배경
 *  - warning: 앰버 밑줄 + 앰버 배경
 *  - 겹치는 위반은 우선순위 기준 dedupe
 */
export function AnnotatedPreview({ text, violations, className }: Props) {
  const segments = useMemo(() => buildSegments(text, violations), [text, violations])

  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed text-[#1E293B] whitespace-pre-wrap break-words',
        className
      )}
    >
      {segments.length === 0 && (
        <span className="text-[#94A3B8]">(미리보기 할 내용이 없습니다)</span>
      )}
      {segments.map((seg, i) =>
        seg.violation ? (
          <span
            key={i}
            className={cn(
              'px-0.5 rounded-sm decoration-wavy underline-offset-[3px]',
              seg.violation.severity === 'error'
                ? 'bg-red-100 text-red-800 decoration-red-500 underline'
                : 'bg-amber-100 text-amber-800 decoration-amber-500 underline'
            )}
            title={seg.violation.reason}
          >
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </div>
  )
}

type Segment = { text: string; violation: LocalViolation | null }

function buildSegments(text: string, violations: LocalViolation[]): Segment[] {
  if (!text) return []
  const filtered = dedupeOverlapping(violations)
  if (filtered.length === 0) return [{ text, violation: null }]

  const segs: Segment[] = []
  let cursor = 0
  for (const v of filtered) {
    if (v.start > cursor) {
      segs.push({ text: text.slice(cursor, v.start), violation: null })
    }
    segs.push({
      text: text.slice(v.start, v.end),
      violation: v,
    })
    cursor = v.end
  }
  if (cursor < text.length) {
    segs.push({ text: text.slice(cursor), violation: null })
  }
  return segs
}
