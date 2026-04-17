import { createAnthropic } from '@ai-sdk/anthropic'

/**
 * Anthropic 클라이언트 싱글톤
 *
 * 모든 AI 호출은 이 client를 거쳐간다. API 키는 서버에서만 접근.
 * callAI / callAIStructured 내부에서 사용하므로 앱 코드에서 직접 import하지 않는다.
 */
let _client: ReturnType<typeof createAnthropic> | null = null

export function getAnthropic() {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey.startsWith('placeholder')) {
      throw new Error(
        'ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local을 확인해주세요.'
      )
    }
    _client = createAnthropic({ apiKey })
  }
  return _client
}
