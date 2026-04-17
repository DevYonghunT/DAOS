import { countNeisBytes } from '@/lib/activity/neis-bytes'
import {
  FORBIDDEN_PATTERNS,
  type PatternRule,
  type Severity,
  type ViolationType,
} from './forbidden-patterns'

export type LocalViolation = {
  type: ViolationType
  severity: Severity
  ruleId: string
  /** 원문 문자열 내 시작 위치 (0-based, UTF-16 인덱스) */
  start: number
  /** 끝 위치 (exclusive) */
  end: number
  matched: string
  reason: string
  guide?: string
}

export type ByteInfo = {
  used: number
  limit: number
  ratio: number
  over: boolean
}

export type LocalCheckResult = {
  violations: LocalViolation[]
  byteInfo: ByteInfo
}

/**
 * 로컬 검수 — 네트워크/LLM 호출 없이 즉시 실행
 *  - 정규식 기반 금지·주의 표현 탐지 (정확한 start/end 제공)
 *  - NEIS 바이트 계산 + 한도 비교
 *  - 결과는 start 오름차순 정렬
 */
export function runLocalChecks(
  text: string,
  byteLimit: number
): LocalCheckResult {
  const violations: LocalViolation[] = []

  for (const rule of FORBIDDEN_PATTERNS) {
    // 매 호출마다 fresh regex (lastIndex 상태 공유 방지)
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags)
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      violations.push({
        type: rule.type,
        severity: rule.severity,
        ruleId: rule.id,
        start: match.index,
        end: match.index + match[0].length,
        matched: match[0],
        reason: rule.reason,
        guide: rule.guide,
      })
      // zero-width match 방지
      if (match.index === regex.lastIndex) regex.lastIndex++
    }
  }

  const used = countNeisBytes(text)
  const ratio = byteLimit > 0 ? used / byteLimit : 0
  const over = byteLimit > 0 && used > byteLimit

  violations.sort((a, b) => a.start - b.start || a.end - b.end)

  return {
    violations,
    byteInfo: {
      used,
      limit: byteLimit,
      ratio,
      over,
    },
  }
}

/**
 * 위반이 겹치는 경우 제거 (우선순위: error > warning, 더 긴 범위 > 짧은 범위)
 * 인라인 하이라이팅 시 이중 마킹 방지용.
 */
export function dedupeOverlapping(
  violations: LocalViolation[]
): LocalViolation[] {
  const sorted = [...violations].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
    return b.end - b.start - (a.end - a.start)
  })
  const out: LocalViolation[] = []
  let lastEnd = -1
  for (const v of sorted) {
    if (v.start >= lastEnd) {
      out.push(v)
      lastEnd = v.end
    }
  }
  return out
}

/**
 * Rule 카탈로그를 룰 id → PatternRule 맵으로 노출 (UI에서 가이드 조회용)
 */
export const PATTERN_RULES_BY_ID: Record<string, PatternRule> = Object.fromEntries(
  FORBIDDEN_PATTERNS.map((r) => [r.id, r])
)
