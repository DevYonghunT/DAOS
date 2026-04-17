'use client'

import { cn } from '@/lib/utils'

type Props = {
  used: number
  limit: number
  className?: string
  /** 보조 텍스트: ex "자율활동" */
  caption?: string
  size?: 'sm' | 'md'
}

/**
 * 바이트 사용량 시각화 프로그래스바.
 *  - 80% 미만: 초록 (정상)
 *  - 80~100%: 앰버 (경고 — 여유 부족)
 *  - 100% 초과: 빨강 (초과)
 */
export function ByteMeter({
  used,
  limit,
  className,
  caption,
  size = 'md',
}: Props) {
  const percent = limit > 0 ? (used / limit) * 100 : 0
  const clamped = Math.min(100, percent)
  const state =
    percent >= 100 ? 'over' : percent >= 80 ? 'warn' : 'ok'

  const trackH = size === 'sm' ? 'h-1.5' : 'h-2'
  const textSize = size === 'sm' ? 'text-[11px]' : 'text-xs'

  const barColor =
    state === 'over'
      ? 'bg-red-500'
      : state === 'warn'
        ? 'bg-amber-500'
        : 'bg-emerald-500'
  const trackColor =
    state === 'over'
      ? 'bg-red-100'
      : state === 'warn'
        ? 'bg-amber-100'
        : 'bg-emerald-100'

  return (
    <div className={cn('w-full', className)}>
      {(caption || size === 'md') && (
        <div
          className={cn(
            'flex items-center justify-between mb-1',
            textSize,
            state === 'over'
              ? 'text-red-700'
              : state === 'warn'
                ? 'text-amber-700'
                : 'text-[#475569]'
          )}
        >
          {caption && <span className="font-medium">{caption}</span>}
          <span className="tabular-nums">
            {used.toLocaleString()} / {limit.toLocaleString()} B
            <span className="ml-1 opacity-70">
              ({Math.round(percent)}%)
            </span>
          </span>
        </div>
      )}
      <div
        className={cn(
          'w-full overflow-hidden rounded-full',
          trackH,
          trackColor
        )}
      >
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${clamped}%` }}
        />
        {percent > 100 && (
          <div className="mt-0.5 text-[10px] text-red-700">
            한도 초과 {Math.round(percent - 100)}%p
          </div>
        )}
      </div>
    </div>
  )
}
