import { streamText, generateText, type StreamTextResult } from 'ai'
import { getAnthropic } from './client'
import { MODELS } from './models'
import { buildCachedSystem } from './cache'
import { deidentifyText, reidentifyText } from './deidentify'
import { logUsage } from './usage'
import type { AICallOptions } from './types'
import type { ModelMessage } from 'ai'

/**
 * 스트리밍 AI 호출 (기본 진입점)
 *
 * 역할:
 *   1. 모델 검증 + 클라이언트 획득
 *   2. 시스템 프롬프트 조립 (캐싱 옵션 적용)
 *   3. 비식별화 적용 (옵션)
 *   4. streamText 호출
 *   5. onFinish에서 usage 로깅
 *
 * 반환: StreamTextResult (UI message stream으로 변환해 Response로 반환 가능)
 */
export function callAI(
  options: Omit<AICallOptions, 'stream'>
): StreamTextResult<Record<string, never>, never> {
  const modelDef = MODELS[options.model]
  if (!modelDef) {
    throw new Error(`알 수 없는 모델: ${options.model}`)
  }

  const anthropic = getAnthropic()
  const model = anthropic(options.model)

  const processedMessages = options.deidentifyMap
    ? deidentifyMessages(options.messages, options.deidentifyMap)
    : options.messages

  const processedSystem = options.deidentifyMap
    ? deidentifyText(options.system, options.deidentifyMap)
    : options.system

  const system = buildCachedSystem(
    processedSystem,
    options.enableCache ?? false
  )

  const maxOutputTokens = options.maxTokens ?? modelDef.maxOutput
  const startTime = Date.now()

  return streamText({
    model,
    system: system as never,
    messages: processedMessages,
    maxOutputTokens,
    maxRetries: 3,
    onFinish: async ({ usage, providerMetadata, response }) => {
      const cacheReadTokens = usage?.inputTokenDetails?.cacheReadTokens ?? 0
      await logUsage({
        teacherId: options.teacherId,
        feature: options.feature,
        model: options.model,
        tokensInput: usage?.inputTokens ?? 0,
        tokensOutput: usage?.outputTokens ?? 0,
        latencyMs: Date.now() - startTime,
        status: 'success',
        cacheHit: cacheReadTokens > 0,
        cacheReadTokens,
        providerRequestId:
          (providerMetadata?.anthropic as { requestId?: string } | undefined)
            ?.requestId ?? response?.id,
      })
    },
    onError: async ({ error }) => {
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
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    },
  })
}

/**
 * 논스트리밍 AI 호출 (한 번에 전체 응답을 문자열로)
 * 사용처: 요약, 타이틀 자동 생성 같은 짧은 출력.
 */
export async function generateAI(
  options: Omit<AICallOptions, 'stream'>
): Promise<{ text: string; tokensInput: number; tokensOutput: number }> {
  const modelDef = MODELS[options.model]
  if (!modelDef) throw new Error(`알 수 없는 모델: ${options.model}`)

  const anthropic = getAnthropic()
  const model = anthropic(options.model)

  const processedMessages = options.deidentifyMap
    ? deidentifyMessages(options.messages, options.deidentifyMap)
    : options.messages

  const processedSystem = options.deidentifyMap
    ? deidentifyText(options.system, options.deidentifyMap)
    : options.system

  const startTime = Date.now()

  try {
    const result = await generateText({
      model,
      system: buildCachedSystem(
        processedSystem,
        options.enableCache ?? false
      ) as never,
      messages: processedMessages,
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

    const finalText = options.deidentifyMap
      ? reidentifyText(result.text, options.deidentifyMap)
      : result.text

    return {
      text: finalText,
      tokensInput: result.usage?.inputTokens ?? 0,
      tokensOutput: result.usage?.outputTokens ?? 0,
    }
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

function deidentifyMessages(
  messages: ModelMessage[],
  map: Map<string, string>
): ModelMessage[] {
  return messages.map((m) => {
    const content = m.content as unknown
    if (typeof content === 'string') {
      return { ...m, content: deidentifyText(content, map) } as ModelMessage
    }
    if (Array.isArray(content)) {
      const newParts = content.map((part: unknown) => {
        if (
          part &&
          typeof part === 'object' &&
          'type' in part &&
          (part as { type: string }).type === 'text' &&
          'text' in part
        ) {
          return {
            ...(part as { text: string }),
            text: deidentifyText((part as { text: string }).text, map),
          }
        }
        return part
      })
      return { ...m, content: newParts } as ModelMessage
    }
    return m
  })
}
