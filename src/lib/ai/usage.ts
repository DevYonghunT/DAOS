import { createClient } from '@/lib/supabase/server'
import { calcCostUsd, isValidModel } from './models'
import type { UsageLogParams } from './types'

/**
 * AI 호출 사용량 로깅
 *
 * 두 테이블에 동시 기록:
 *   - usage_logs: 비용 집계용 (teacher_id, feature, tokens, cost_usd)
 *   - ai_requests: 디버깅/캐시 효과용 (latency, status, cache_hit, provider_request_id)
 *
 * 실패해도 사용자 경험에는 영향 없도록 try/catch로 감싼다. (에러는 console)
 */
export async function logUsage(params: UsageLogParams): Promise<void> {
  const {
    teacherId,
    feature,
    model,
    tokensInput,
    tokensOutput,
    latencyMs,
    status,
    cacheHit,
    cacheReadTokens,
    providerRequestId,
    errorMessage,
  } = params

  const costUsd = isValidModel(model)
    ? calcCostUsd(model, tokensInput, tokensOutput)
    : 0

  try {
    const supabase = await createClient()
    await Promise.all([
      supabase.from('usage_logs').insert({
        teacher_id: teacherId,
        feature,
        model,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        cost_usd: costUsd,
      }),
      supabase.from('ai_requests').insert({
        teacher_id: teacherId,
        feature,
        model,
        latency_ms: latencyMs,
        status,
        cache_hit: cacheHit,
        cache_read_tokens: cacheReadTokens,
        provider_request_id: providerRequestId ?? null,
        error_message: errorMessage ?? null,
      }),
    ])
  } catch (err) {
    console.error('[ai/usage] logUsage 실패:', err)
  }
}
