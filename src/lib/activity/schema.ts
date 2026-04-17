import { z } from 'zod'
import { RECORD_CATEGORY_KEYS } from './categories'

const CategoryEnum = z.enum(
  RECORD_CATEGORY_KEYS as [string, ...string[]]
)

export const ProgramUpsertSchema = z.object({
  academic_year: z
    .number()
    .int()
    .min(2020)
    .max(2100)
    .default(new Date().getFullYear()),
  department: z.string().min(1, '부서는 필수입니다').max(50),
  program_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '형식 YYYY-MM-DD'),
  program_name: z.string().min(1, '프로그램명은 필수입니다').max(200),
  setuk_template: z.string().max(4000).nullable().optional(),
  /** 기재 영역 key (카탈로그에서 enum) */
  record_category: CategoryEnum,
  target_grade: z.string().max(50).nullable().optional(),
  status: z.enum(['planned', 'completed']).default('planned'),
  /**
   * byte_limit은 클라이언트에서 보내도 서버가 카테고리 기준으로 덮어씀.
   * (사용자 수동 변경 불가 — 기재요령 고정값)
   */
  byte_limit: z.number().int().optional(),
})

export type ProgramUpsertInput = z.infer<typeof ProgramUpsertSchema>

export const AddParticipantsSchema = z.object({
  student_ids: z.array(z.string().uuid()).min(1, '한 명 이상 선택하세요'),
})

export type AddParticipantsInput = z.infer<typeof AddParticipantsSchema>
