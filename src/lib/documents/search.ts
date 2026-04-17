import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { estimateTokens } from './extract'

type ChunkRow = {
  id: string
  chunk_index: number
  heading: string | null
  content: string
  token_count: number | null
  version_id: string
  document_title: string
  document_category: string
  version_number: number
  effective_date: string | null
}

export type RelevantChunk = ChunkRow & {
  score: number
}

/**
 * 사용자 질문의 키워드로 관련 청크를 선별한다.
 *
 * 전략 (임베딩 없이 키워드 매칭):
 *  1. 질문에서 의미 있는 키워드 추출 (조사·접속사 제거)
 *  2. 각 청크의 heading + content에서 키워드 등장 횟수로 score 산정
 *  3. score 상위 청크를 토큰 버짓 내에서 수집
 *
 * 이 방식은 벡터 검색 대비 정밀도가 낮지만,
 * 학교 규정처럼 "제N조", "출결", "세특" 같은 명확한 키워드가 많은 문서에선 효과적.
 */

const MAX_CONTEXT_TOKENS = 80_000 // system 프롬프트 본체(~2k) + 여유 포함 안전 한도
const MIN_KEYWORD_LENGTH = 2

// 한국어 불용어 (조사·접속사·어미)
const STOPWORDS = new Set([
  '이', '가', '을', '를', '에', '의', '는', '은', '으로', '로', '에서',
  '와', '과', '도', '만', '까지', '부터', '에게', '한테', '께',
  '그', '이것', '저것', '그것', '것', '수', '때', '등', '및',
  '하다', '되다', '있다', '없다', '않다', '같다',
  '그리고', '하지만', '또는', '그러나', '그래서', '때문에',
  '어떻게', '무엇', '어디', '언제', '누구', '왜',
  '합니다', '입니다', '습니다', '있습니다', '됩니다',
  '해주세요', '알려주세요', '뭔가요', '인가요', '인지',
])

export function extractKeywords(query: string): string[] {
  return query
    .replace(/[?.,!;:()"'""'']/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= MIN_KEYWORD_LENGTH && !STOPWORDS.has(w))
}

function scoreChunk(chunk: { heading: string | null; content: string }, keywords: string[]): number {
  if (keywords.length === 0) return 0
  const text = ((chunk.heading ?? '') + ' ' + chunk.content).toLowerCase()
  let score = 0
  for (const kw of keywords) {
    const lower = kw.toLowerCase()
    // heading 매칭은 가중치 3배
    if (chunk.heading?.toLowerCase().includes(lower)) {
      score += 3
    }
    // content 매칭
    const matches = text.split(lower).length - 1
    score += matches
  }
  return score
}

/**
 * 현재 효력 문서의 청크 중 질문 관련 상위 N개를 토큰 버짓 내에서 반환
 */
export async function searchRelevantChunks(
  supabase: SupabaseClient,
  query: string
): Promise<RelevantChunk[]> {
  // 1. 현재 효력 버전 + 문서 메타 조회
  const { data: versions } = await supabase
    .from('document_versions')
    .select('id, document_id, version, effective_date, documents(title, category)')
    .eq('is_current', true)

  if (!versions || versions.length === 0) return []

  const versionIds = versions.map((v) => v.id)
  const versionMeta = new Map(
    versions.map((v) => {
      const doc = Array.isArray(v.documents) ? v.documents[0] : v.documents
      return [
        v.id,
        {
          document_title: (doc as { title?: string })?.title ?? '제목 미지정',
          document_category: (doc as { category?: string })?.category ?? 'other',
          version_number: v.version,
          effective_date: v.effective_date,
        },
      ]
    })
  )

  // 2. 모든 현재 청크 로드
  const { data: allChunks } = await supabase
    .from('document_chunks')
    .select('id, version_id, chunk_index, heading, content, token_count')
    .in('version_id', versionIds)
    .order('chunk_index', { ascending: true })

  if (!allChunks || allChunks.length === 0) return []

  // 3. 키워드 추출 + 스코어링
  const keywords = extractKeywords(query)

  const scored: RelevantChunk[] = allChunks.map((c) => {
    const meta = versionMeta.get(c.version_id)!
    return {
      ...c,
      ...meta,
      score: scoreChunk(c, keywords),
    }
  })

  // 키워드가 없으면 (너무 짧은 질문) → 앞쪽 청크부터 버짓만큼
  if (keywords.length === 0) {
    return fillBudget(scored.sort((a, b) => a.chunk_index - b.chunk_index))
  }

  // score 내림차순, 동점이면 chunk_index 오름차순
  scored.sort((a, b) => b.score - a.score || a.chunk_index - b.chunk_index)

  // score > 0인 것만, 토큰 버짓 내에서
  const relevant = scored.filter((c) => c.score > 0)
  if (relevant.length === 0) {
    // 매칭 없으면 앞쪽 청크 기본 제공
    return fillBudget(scored.sort((a, b) => a.chunk_index - b.chunk_index))
  }

  return fillBudget(relevant)
}

function fillBudget(chunks: RelevantChunk[]): RelevantChunk[] {
  const result: RelevantChunk[] = []
  let usedTokens = 0
  for (const c of chunks) {
    const tk = c.token_count ?? estimateTokens(c.content)
    if (usedTokens + tk > MAX_CONTEXT_TOKENS) break
    result.push(c)
    usedTokens += tk
  }
  return result
}
