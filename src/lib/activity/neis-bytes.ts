/**
 * NEIS(교육정보시스템) 입력 바이트 계산
 *
 * 2026 학교생활기록부 기재요령 p.208:
 *  "교육정보시스템에서 입력 글자의 단위는 Byte이며,
 *   한글 1자는 3Byte, 영문·숫자 1자는 1Byte, 엔터(Enter)는 1Byte임."
 *
 * 구현 규칙:
 *  - ASCII (U+0000~U+007F)   → 1 바이트  (영문/숫자/기본 특수)
 *  - LF/CR                    → 1 바이트  (엔터)
 *  - 그 외 유니코드           → 3 바이트  (한글/한자/전각 기호 등)
 *
 * 이 정의는 NEIS 실제 계산 방식과 동일하게 작동함.
 */
export function countNeisBytes(text: string | null | undefined): number {
  if (!text) return 0
  let bytes = 0
  // iterator를 쓰면 서러게이트 페어도 안전하게 처리됨
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code <= 0x7f) {
      // ASCII 범위: 줄바꿈(LF=0x0A, CR=0x0D) 포함
      bytes += 1
    } else {
      bytes += 3
    }
  }
  return bytes
}

/**
 * 주어진 바이트 한도 내에서 문자열을 잘라냄 (유효한 경계에서만).
 * 입력 제한 보조 용도.
 */
export function truncateToNeisBytes(text: string, maxBytes: number): string {
  if (!text) return ''
  let bytes = 0
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    const add = code <= 0x7f ? 1 : 3
    if (bytes + add > maxBytes) break
    out += ch
    bytes += add
  }
  return out
}

export function usagePercent(bytesUsed: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(999, Math.round((bytesUsed / limit) * 100))
}
