import { z } from 'zod'

export const ConsultationSummarySchema = z.object({
  date: z.string().describe('상담 일자. YYYY-MM-DD 형식.'),
  attendees: z.string().describe('참석자. 예: "담임 김OO, 학부모 이OO"'),
  agenda: z
    .array(z.string())
    .describe('주요 안건 목록. 1~5개. 핵심만 짧게.'),
  details: z
    .string()
    .describe('상세 내용 요약. 2~5문장. 구체적 사실 중심.'),
  agreements: z
    .array(z.string())
    .describe('합의/결정 사항 목록. 없으면 빈 배열.'),
  follow_up: z
    .string()
    .describe('후속 조치 계획. 없으면 "없음".'),
  follow_up_date: z
    .string()
    .nullable()
    .describe('후속 조치 일자. YYYY-MM-DD 또는 null.'),
})

export type ConsultationSummaryParsed = z.infer<typeof ConsultationSummarySchema>

export const ConsultUpsertSchema = z.object({
  student_id: z.string().uuid(),
  academic_year: z.number().int().min(2020).max(2100),
  consultation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  attendees: z.string().max(500).nullable().optional(),
  raw_input: z.string().max(10000).nullable().optional(),
  structured_summary: ConsultationSummarySchema.nullable().optional(),
  follow_up_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  is_completed: z.boolean().default(false),
})

export type ConsultUpsertInput = z.infer<typeof ConsultUpsertSchema>
