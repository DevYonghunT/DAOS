import 'server-only'
import { generateText } from 'ai'
import { getAnthropic } from '@/lib/ai/client'
import { logUsage } from '@/lib/ai/usage'
import type { ModelId } from '@/lib/ai/models'
import { MODELS } from '@/lib/ai/models'
import { splitPdfIfNeeded } from './pdf-split'

/**
 * Claude의 네이티브 PDF 이해 기능 + 자동 분할을 사용하여
 * PDF 버퍼를 Markdown 문자열로 변환한다.
 *
 * 100페이지 초과 PDF는 자동으로 100페이지 단위로 분할 후
 * 각각 Claude에 보내고 결과를 합친다.
 *
 * 제약:
 *  - 전체 PDF 최대 32 MB (Anthropic 제한)
 *  - 분할 후 각 청크가 32MB 이하여야 함
 *  - 비용: 분할 수 × (입력 + 출력) 토큰
 */

const CONVERSION_SYSTEM = `너는 PDF 문서를 **원문의 구조와 내용을 정확히 보존**하면서 Markdown으로 변환하는 전문가다.

[규칙]
1. 원문을 요약·해석·윤색하지 말 것. 있는 그대로 옮길 것.
2. 구조 표시:
   - 장/편/대제목 → \`#\`
   - 절/중제목 → \`##\`
   - 조항/소제목 → \`###\`
   - 목록 → \`-\` 또는 \`1.\`
   - 표 → 파이프 \`|\` Markdown 테이블
   - 인용/강조 → \`>\` 또는 \`**볼드**\`
3. 페이지 번호·헤더·푸터 등 편집 노이즈는 제외.
4. 한국어 원문이면 한국어 그대로. 번역 금지.
5. 본문 외 어떤 설명·메타 멘트도 금지. 오직 변환된 Markdown만 출력.`

export type AiConvertOptions = {
  buffer: Buffer
  fileName: string
  teacherId: string
  model?: ModelId
}

export type AiConvertResult = {
  markdown: string
  totalPages: number
  chunksProcessed: number
  tokensInput: number
  tokensOutput: number
  model: string
  latencyMs: number
}

export async function convertPdfToMarkdown(
  opts: AiConvertOptions
): Promise<AiConvertResult> {
  const model: ModelId = opts.model ?? 'claude-haiku-4-5'
  const modelDef = MODELS[model]
  if (!modelDef) throw new Error(`알 수 없는 모델: ${model}`)

  const startTime = Date.now()

  // 1. 100페이지 단위 자동 분할
  const chunks = await splitPdfIfNeeded(opts.buffer, 100)
  const totalPages = chunks.reduce((a, c) => a + c.pageCount, 0)

  // 2. 각 청크를 Claude로 변환
  const markdownParts: string[] = []
  let totalIn = 0
  let totalOut = 0

  for (const chunk of chunks) {
    const partLabel =
      chunks.length > 1
        ? ` (${chunk.startPage}~${chunk.endPage}페이지, ${chunk.index + 1}/${chunks.length})`
        : ''

    const result = await callClaudeForPdf({
      buffer: chunk.buffer,
      fileName: `${opts.fileName}${partLabel}`,
      model,
      extraInstruction:
        chunks.length > 1
          ? `이 PDF는 전체 문서의 ${chunk.startPage}~${chunk.endPage}페이지 부분입니다. 이 범위의 내용만 Markdown으로 변환하세요.`
          : '이 PDF 문서를 구조를 보존한 Markdown으로 변환해줘.',
    })

    markdownParts.push(result.text)
    totalIn += result.tokensInput
    totalOut += result.tokensOutput
  }

  const latencyMs = Date.now() - startTime

  // 3. 사용량 한 번에 기록 (분할된 경우 합산)
  await logUsage({
    teacherId: opts.teacherId,
    feature: 'rules',
    model,
    tokensInput: totalIn,
    tokensOutput: totalOut,
    latencyMs,
    status: 'success',
    cacheHit: false,
    cacheReadTokens: 0,
  })

  // 4. 분할된 파트 합치기 (구분선으로 연결)
  const markdown =
    chunks.length === 1
      ? markdownParts[0]
      : markdownParts
          .map(
            (md, i) =>
              `<!-- Part ${i + 1}: 페이지 ${chunks[i].startPage}~${chunks[i].endPage} -->\n\n${md}`
          )
          .join('\n\n---\n\n')

  if (!markdown.trim()) {
    throw new Error('AI가 빈 Markdown을 반환했습니다.')
  }

  return {
    markdown,
    totalPages,
    chunksProcessed: chunks.length,
    tokensInput: totalIn,
    tokensOutput: totalOut,
    model,
    latencyMs,
  }
}

// ─── 내부 헬퍼 ──────────────────────────────────────────────

async function callClaudeForPdf(args: {
  buffer: Buffer
  fileName: string
  model: ModelId
  extraInstruction: string
}): Promise<{ text: string; tokensInput: number; tokensOutput: number }> {
  const anthropic = getAnthropic()
  const modelDef = MODELS[args.model]

  const result = await generateText({
    model: anthropic(args.model),
    system: CONVERSION_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: args.buffer,
            mediaType: 'application/pdf',
            filename: args.fileName,
          },
          {
            type: 'text',
            text: args.extraInstruction,
          },
        ],
      },
    ],
    maxOutputTokens: modelDef.maxOutput,
    maxRetries: 2,
  })

  return {
    text: result.text?.trim() ?? '',
    tokensInput: result.usage?.inputTokens ?? 0,
    tokensOutput: result.usage?.outputTokens ?? 0,
  }
}
