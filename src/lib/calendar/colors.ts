import type { EventColor } from '@/types/calendar'

/**
 * 일정 색상 → Tailwind 클래스 매핑
 * 캘린더 셀의 pill / 상세 배지 모두에서 사용
 */
export const EVENT_COLOR_STYLES: Record<
  EventColor,
  { pill: string; dot: string; label: string }
> = {
  blue: {
    pill: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    label: '파랑 (수업)',
  },
  cyan: {
    pill: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    dot: 'bg-cyan-500',
    label: '청록 (회의)',
  },
  amber: {
    pill: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    label: '노랑 (학교 행사)',
  },
  green: {
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    label: '초록 (업무)',
  },
  red: {
    pill: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-500',
    label: '빨강 (시험)',
  },
  violet: {
    pill: 'bg-violet-50 text-violet-700 border-violet-200',
    dot: 'bg-violet-500',
    label: '보라 (연수)',
  },
  slate: {
    pill: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-500',
    label: '회색 (개인)',
  },
}

export function normalizeColor(color: string | null | undefined): EventColor {
  if (color && color in EVENT_COLOR_STYLES) return color as EventColor
  return 'blue'
}
