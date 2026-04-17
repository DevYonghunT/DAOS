/**
 * @AI 멘션 감지 + 제거
 *
 * 학생이 "@AI 조선 후기 경제구조가 뭐야?" 같이 입력 시:
 *  - detectsAIMention → true
 *  - stripAIMention → "조선 후기 경제구조가 뭐야?"
 */

const AI_MENTION_REGEX = /@(AI|ai|Claude|claude|에이아이)\b/g

export function detectsAIMention(content: string): boolean {
  return AI_MENTION_REGEX.test(content)
}

export function stripAIMention(content: string): string {
  return content.replace(AI_MENTION_REGEX, '').trim()
}
