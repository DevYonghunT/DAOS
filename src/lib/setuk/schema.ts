import { z } from 'zod'
import { RECORD_CATEGORY_KEYS } from '@/lib/activity/categories'

const CategoryEnum = z.enum(
  RECORD_CATEGORY_KEYS as [string, ...string[]]
)

export const DraftUpsertSchema = z.object({
  student_id: z.string().uuid().nullable().optional(),
  student_label: z.string().min(1).max(100),
  academic_year: z.number().int().min(2020).max(2100),
  /** record_category key (카탈로그) 또는 과목명(교과세특) */
  subject: z.string().min(1).max(100),
  /** 학년-반-번호 */
  grade_class: z.string().max(30).nullable().optional(),
  /** 생성 시 입력한 키워드 */
  keywords: z.string().max(2000).nullable().optional(),
  /** AI가 생성한 초안 */
  draft: z.string().max(10000).nullable().optional(),
  /** 교사가 최종 편집한 본문 */
  final_text: z.string().max(10000).nullable().optional(),
  /** 카테고리 한도 — 서버에서 카테고리 기준으로 강제 */
  byte_limit: z.number().int().optional(),
  status: z.enum(['draft', 'reviewed', 'finalized']).default('draft'),
})

export type DraftUpsertInput = z.infer<typeof DraftUpsertSchema>

export { CategoryEnum }
