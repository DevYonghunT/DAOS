/**
 * 덕수고 교사 계정 정책:
 *  - 이메일이 't'로 시작해야 함 (교사 아이디 규칙)
 *  - 도메인은 @duksoo.hs.kr 여야 함
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const lower = email.toLowerCase().trim()
  return lower.startsWith('t') && lower.endsWith('@duksoo.hs.kr')
}

export const ALLOWED_EMAIL_HINT = 't로 시작하는 덕수고등학교 교직원 계정(@duksoo.hs.kr)만 이용할 수 있습니다.'
export const ALLOWED_DOMAIN = 'duksoo.hs.kr'
