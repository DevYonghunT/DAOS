import type { ModelMessage } from 'ai'
import type { ModelId } from './models'

export type Feature =
  | 'chat'
  | 'setuk'
  | 'review'
  | 'rules'
  | 'consult'
  | 'calendar'
  | 'activity'
  | 'classroom'

export type CallStatus = 'success' | 'error' | 'timeout'

/** callAI 공통 옵션 */
export type AICallOptions = {
  model: ModelId
  system: string
  messages: ModelMessage[]
  feature: Feature
  teacherId: string
  stream?: boolean
  enableCache?: boolean
  /** 실명 → 비식별 라벨 매핑 (있으면 요청 시 적용) */
  deidentifyMap?: Map<string, string>
  maxTokens?: number
  /** Anthropic 도구 (web_search 등) */
  tools?: Record<string, unknown>
}

/** logUsage 인자 */
export type UsageLogParams = {
  teacherId: string
  feature: Feature
  model: string
  tokensInput: number
  tokensOutput: number
  latencyMs: number
  status: CallStatus
  cacheHit: boolean
  cacheReadTokens: number
  providerRequestId?: string
  errorMessage?: string
}
