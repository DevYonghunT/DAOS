/**
 * AI 모델 카탈로그
 * - 가격은 $/1M tokens 기준 (2026-04 플랜 문서 참조)
 * - 앱 전체에서 이 MODELS만 사용 → 새 모델 추가 시 여기만 수정
 */
export const MODELS = {
  'claude-haiku-4-5': {
    id: 'claude-haiku-4-5',
    name: 'Haiku 4.5',
    label: '빠름·경제적',
    description: '빠른 응답, 저비용. 간단한 질문에 적합',
    costPerMInput: 1,
    costPerMOutput: 5,
    maxOutput: 4096,
    supportsStreaming: true,
    supportsVision: true,
    supportsWebSearch: true,
  },
  'claude-sonnet-4-6': {
    id: 'claude-sonnet-4-6',
    name: 'Sonnet 4.6',
    label: '균형',
    description: '응답 품질·속도·비용이 균형잡힌 기본 모델',
    costPerMInput: 3,
    costPerMOutput: 15,
    maxOutput: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsWebSearch: true,
  },
  'claude-opus-4-6': {
    id: 'claude-opus-4-6',
    name: 'Opus 4.6',
    label: '최고 성능',
    description: '복잡한 작성·분석. 비용이 가장 높음',
    costPerMInput: 5,
    costPerMOutput: 25,
    maxOutput: 8192,
    supportsStreaming: true,
    supportsVision: true,
    supportsWebSearch: true,
  },
} as const

export type ModelId = keyof typeof MODELS
export const DEFAULT_MODEL: ModelId = 'claude-haiku-4-5'

export function isValidModel(id: string): id is ModelId {
  return id in MODELS
}

export function calcCostUsd(
  modelId: ModelId,
  tokensInput: number,
  tokensOutput: number
): number {
  const m = MODELS[modelId]
  return (
    (tokensInput * m.costPerMInput + tokensOutput * m.costPerMOutput) /
    1_000_000
  )
}
