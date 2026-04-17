import { generateObject } from 'ai'
import { z } from 'zod'
import { getAnthropic } from './client'
import { MODELS } from './models'
import { buildCachedSystem } from './cache'
import { deidentifyText, reidentifyText } from './deidentify'
import { logUsage } from './usage'
import type { AICallOptions } from './types'

/**
 * Structured Outputs 래퍼
 *
 * callAI와 달리 스키마에 맞춘 JSON을 반환.
 * 캘린더 파싱, 학생부 검수 제안, 상담 구조화 등에 사용.
 *
 * @param schema Zod 스키마 (타입 추론 자동)
 */
export async function callAIStructured<T extends z.ZodTypeAny>(
  options: Omit<AICallOptions, 'stream'> & {
    schema: T
    schemaName?: string
    schemaDescription?: string
  }
): Promise<z.infer<T>> {
  const modelDef = MODELS[options.model]
  if (!modelDef) throw new Error(`알 수 없는 모델: ${options.model}`)

  const anthropic = getAnthropic()
  const model = anthropic(options.model)

  const processedMessages = (
    options.deidentifyMap
      ? options.messages.map((m) => {
          const content = m.content as unknown
          if (typeof content === 'string') {
            return {
              ...m,
              content: deidentifyText(content, options.deidentifyMap!),
            }
          }
          return m
        })
      : options.messages
  ) as typeof options.messages

  const processedSystem = options.deidentifyMap
    ? deidentifyText(options.system, options.deidentifyMap)
    : options.system

  const startTime = Date.now()

  try {
    const result = await generateObject({
      model,
      system: buildCachedSystem(
        processedSystem,
        options.enableCache ?? false
      ) as never,
      messages: processedMessages,
      schema: options.schema,
      schemaName: options.schemaName,
      schemaDescription: options.schemaDescription,
      maxOutputTokens: options.maxTokens ?? modelDef.maxOutput,
      maxRetries: 3,
    })

    const cacheReadTokens = result.usage?.inputTokenDetails?.cacheReadTokens ?? 0
    await logUsage({
      teacherId: options.teacherId,
      feature: options.feature,
      model: options.model,
      tokensInput: result.usage?.inputTokens ?? 0,
      tokensOutput: result.usage?.outputTokens ?? 0,
      latencyMs: Date.now() - startTime,
      status: 'success',
      cacheHit: cacheReadTokens > 0,
      cacheReadTokens,
      providerRequestId: result.response?.id,
    })

    // 재식별화: 문자열 필드에 대해 재귀 적용
    const obj = result.object as unknown
    return (
      options.deidentifyMap
        ? reidentifyDeep(obj, options.deidentifyMap)
        : obj
    ) as z.infer<T>
  } catch (err) {
    await logUsage({
      teacherId: options.teacherId,
      feature: options.feature,
      model: options.model,
      tokensInput: 0,
      tokensOutput: 0,
      latencyMs: Date.now() - startTime,
      status: 'error',
      cacheHit: false,
      cacheReadTokens: 0,
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

function reidentifyDeep(value: unknown, map: Map<string, string>): unknown {
  if (typeof value === 'string') return reidentifyText(value, map)
  if (Array.isArray(value)) return value.map((v) => reidentifyDeep(v, map))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = reidentifyDeep(v, map)
    }
    return out
  }
  return value
}
