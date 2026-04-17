import { estimateTokens } from './extract'

export type Chunk = {
  index: number
  heading: string | null
  content: string
  pageNo: number | null
  tokenCount: number
}

/**
 * 문서 청킹
 *
 * 전략:
 *  1) 한국어 학교 문서 패턴(제N장, 제N조, N. 등)으로 1차 분할.
 *     - 각 청크에 가장 가까운 상위 헤딩(섹션 제목)을 부착
 *  2) 패턴이 거의 없거나 청크가 너무 크면 → MAX_TOKENS 단위로 2차 분할
 *  3) 빈 청크 제거
 */

const MAX_TOKENS_PER_CHUNK = 600
const MIN_CONTENT_LEN = 20

// 한국 행정·학교 문서에서 자주 쓰는 헤딩 패턴
// 예: "제1장 총칙", "제2조(목적)", "1. 일반 사항", "Ⅰ. 서론"
const HEADING_PATTERNS: Array<{ name: string; regex: RegExp; level: number }> = [
  { name: 'chapter', regex: /^\s*제\s*\d+\s*장(?:\s*[^\n]*)?$/, level: 1 },
  { name: 'section', regex: /^\s*제\s*\d+\s*절(?:\s*[^\n]*)?$/, level: 2 },
  { name: 'article', regex: /^\s*제\s*\d+\s*조(?:[^\n]*)?$/, level: 3 },
  { name: 'roman', regex: /^\s*[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]\.\s*[^\n]+$/, level: 1 },
  { name: 'numbered-major', regex: /^\s*\d+\.\s+[^\n]{1,50}$/, level: 2 },
]

type RawSegment = {
  heading: string | null
  parentHeading: string | null
  text: string
  startLine: number
}

/**
 * 텍스트를 헤딩 기준으로 1차 분할
 * 헤딩 후보로 보이는 한 줄짜리 라인을 만나면 새 세그먼트 시작
 */
function splitByHeadings(text: string): RawSegment[] {
  const lines = text.split('\n')
  const segments: RawSegment[] = []
  let currentText: string[] = []
  let currentHeading: string | null = null
  let parentHeading: string | null = null
  let startLine = 0

  const flush = (i: number) => {
    const body = currentText.join('\n').trim()
    if (body.length >= MIN_CONTENT_LEN || currentHeading) {
      segments.push({
        heading: currentHeading,
        parentHeading,
        text: body,
        startLine,
      })
    }
    currentText = []
    startLine = i
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (!trimmed) {
      currentText.push(raw)
      continue
    }
    const matched = HEADING_PATTERNS.find((p) => p.regex.test(trimmed))
    if (matched) {
      // 헤딩 만남 → 이전 누적 flush
      flush(i)
      if (matched.level <= 1) {
        parentHeading = trimmed
        currentHeading = trimmed
      } else if (matched.level === 2) {
        currentHeading = trimmed
      } else {
        // 더 깊은 레벨은 현재 헤딩의 하위로 묶음
        currentHeading = trimmed
      }
      continue
    }
    currentText.push(raw)
  }
  flush(lines.length)
  return segments
}

/**
 * 큰 세그먼트를 토큰 한도 내로 재분할
 * 문단(빈 줄) 단위로 합치다가 한도 넘으면 새 청크
 */
function packSegments(segments: RawSegment[]): Chunk[] {
  const chunks: Chunk[] = []
  let idx = 0

  for (const seg of segments) {
    const paragraphs = seg.text.split(/\n\s*\n+/)
    let buffer: string[] = []
    let bufferTokens = 0
    const headingDisplay = seg.heading ?? seg.parentHeading

    const flush = () => {
      const body = buffer.join('\n\n').trim()
      if (!body) return
      chunks.push({
        index: idx++,
        heading: headingDisplay,
        content: body,
        pageNo: null,
        tokenCount: estimateTokens(body),
      })
      buffer = []
      bufferTokens = 0
    }

    for (const para of paragraphs) {
      const t = para.trim()
      if (!t) continue
      const tk = estimateTokens(t)
      if (tk > MAX_TOKENS_PER_CHUNK) {
        // 단일 문단이 너무 크면 문장 단위 슬라이스
        flush()
        for (const piece of sliceBySentences(t, MAX_TOKENS_PER_CHUNK)) {
          chunks.push({
            index: idx++,
            heading: headingDisplay,
            content: piece,
            pageNo: null,
            tokenCount: estimateTokens(piece),
          })
        }
        continue
      }
      if (bufferTokens + tk > MAX_TOKENS_PER_CHUNK && buffer.length > 0) {
        flush()
      }
      buffer.push(t)
      bufferTokens += tk
    }
    flush()
  }

  return chunks
}

/**
 * 단일 거대 문단 → 마침표/줄바꿈/길이 기준으로 슬라이스
 */
function sliceBySentences(text: string, maxTokens: number): string[] {
  const sentences = text.split(/(?<=[.!?。·])\s+|\n+/)
  const out: string[] = []
  let buf: string[] = []
  let bufTk = 0
  for (const s of sentences) {
    const t = s.trim()
    if (!t) continue
    const tk = estimateTokens(t)
    if (bufTk + tk > maxTokens && buf.length > 0) {
      out.push(buf.join(' '))
      buf = []
      bufTk = 0
    }
    buf.push(t)
    bufTk += tk
  }
  if (buf.length) out.push(buf.join(' '))
  return out
}

/**
 * 메인 청크 함수
 */
export function chunkDocument(text: string): Chunk[] {
  const segments = splitByHeadings(text)
  // 헤딩 패턴이 거의 없으면 (segments=1, no heading) → 단일 큰 세그먼트로 처리
  return packSegments(segments)
}

export function summarizeChunks(chunks: Chunk[]): {
  count: number
  totalTokens: number
  avgTokens: number
} {
  const totalTokens = chunks.reduce((a, c) => a + c.tokenCount, 0)
  return {
    count: chunks.length,
    totalTokens,
    avgTokens: chunks.length ? Math.round(totalTokens / chunks.length) : 0,
  }
}
