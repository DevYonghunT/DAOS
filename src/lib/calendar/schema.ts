import { z } from 'zod'

/**
 * 자연어 → 일정 객체 파싱용 스키마
 * Anthropic Structured Outputs (generateObject)에서 사용
 */
export const CalendarEventSchema = z.object({
  title: z.string().min(1).describe('일정 제목. 핵심 키워드만. 최대 50자.'),
  start_date: z
    .string()
    .describe(
      'ISO 8601 형식의 시작 일시. 한국 표준시(KST, UTC+9) 오프셋 포함. 예: 2026-04-15T14:00:00+09:00'
    ),
  end_date: z
    .string()
    .nullable()
    .describe('ISO 8601 종료 일시. 기간이 명확하지 않으면 null.'),
  all_day: z
    .boolean()
    .describe(
      '종일 일정이면 true, 구체적 시간대가 있으면 false. 시간이 지정되지 않은 단순 날짜는 종일로 본다.'
    ),
  description: z
    .string()
    .nullable()
    .describe('추가 설명. 입력에 부연설명 없으면 null.'),
  assignee_names: z
    .array(z.string())
    .describe(
      '일정 대상/담당 교사 이름 배열. 본인이 대상이면 빈 배열로 둠. 예: ["김덕수", "이영희"]'
    ),
  event_type: z
    .enum(['personal', 'shared', 'school'])
    .describe(
      "일정 범위. 본인 것=personal, 특정 교사 공유=shared, 학교 전체=school"
    ),
  suggested_color: z
    .enum(['blue', 'cyan', 'amber', 'green', 'red', 'violet', 'slate'])
    .describe(
      '일정 성격에 맞는 색. 수업=blue, 회의=cyan, 학교 행사=amber, 시험=red, 개인=slate'
    ),
})

export type ParsedCalendarEvent = z.infer<typeof CalendarEventSchema>

/**
 * 일정 생성/수정 폼 입력 스키마
 */
export const EventUpsertSchema = z.object({
  title: z.string().min(1, '제목은 필수입니다').max(200),
  description: z.string().nullable().optional(),
  start_date: z.string().min(1, '시작 일시는 필수입니다'),
  end_date: z.string().nullable().optional(),
  all_day: z.boolean(),
  color: z
    .enum(['blue', 'cyan', 'amber', 'green', 'red', 'violet', 'slate'])
    .default('blue'),
  event_type: z.enum(['personal', 'shared', 'school']).default('personal'),
  /** 공유 대상 teachers.id 목록 (shared 타입일 때) */
  share_with: z.array(z.string().uuid()).optional(),
})

export type EventUpsertInput = z.infer<typeof EventUpsertSchema>
