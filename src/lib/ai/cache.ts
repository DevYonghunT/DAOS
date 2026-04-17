/**
 * Anthropic prompt caching 헬퍼
 *
 * AI SDK v6에서 system 프롬프트 캐싱은 SystemModelMessage 포맷으로 지정한다:
 * ```ts
 *   system: {
 *     role: 'system',
 *     content: systemPrompt,
 *     providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } }
 *   }
 * ```
 * 이 함수는 system 프롬프트 문자열을 위 포맷으로 변환한다.
 * 캐싱 비활성 시엔 문자열 그대로 반환.
 */

export type CacheableSystem =
  | string
  | {
      role: 'system'
      content: string
      providerOptions?: {
        anthropic?: {
          cacheControl?: { type: 'ephemeral' }
        }
      }
    }

export function buildCachedSystem(
  system: string,
  enableCache: boolean
): CacheableSystem {
  if (!enableCache) return system
  return {
    role: 'system',
    content: system,
    providerOptions: {
      anthropic: { cacheControl: { type: 'ephemeral' } },
    },
  }
}
