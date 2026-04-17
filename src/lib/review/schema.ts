import { z } from 'zod'

/**
 * LLM이 반환할 세특 검수 제안 스키마
 * Structured Outputs (generateObject)로 강제
 */
export const ReviewSuggestionSchema = z.object({
  original_sentence: z
    .string()
    .describe('원문에서 문제가 되는 문장을 그대로 인용'),
  suggestion: z
    .string()
    .describe('개선 제안 문장. 원문 의미 보존, 더 자연스럽고 중립적 표현.'),
  reason: z
    .string()
    .describe(
      '제안 이유. 예: "비교 표현 제거", "더 객관적 묘사", "맞춤법 교정" 등'
    ),
  category: z
    .enum(['spelling', 'grammar', 'policy', 'tone', 'clarity'])
    .describe(
      'spelling(맞춤법) / grammar(문법) / policy(지침 위반) / tone(어조) / clarity(명료성)'
    ),
})

export type ReviewSuggestion = z.infer<typeof ReviewSuggestionSchema>

export const ReviewResponseSchema = z.object({
  overall_comment: z
    .string()
    .nullable()
    .describe('전반적 평가 한 줄. 개선 사항 없으면 "잘 작성되었습니다." 같은 짧은 메시지.'),
  suggestions: z
    .array(ReviewSuggestionSchema)
    .describe('개별 개선 제안 목록. 개선 여지 없으면 빈 배열.'),
})

export type ReviewResponse = z.infer<typeof ReviewResponseSchema>
