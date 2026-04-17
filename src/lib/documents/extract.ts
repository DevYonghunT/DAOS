import 'server-only'

/**
 * 문서 텍스트 추출
 *
 * 지원 포맷:
 *  - PDF:  unpdf (서버리스/Node 양쪽 호환, pdfjs 래핑)
 *  - DOCX: mammoth (서식 무시, 본문 텍스트만)
 *  - MD:   UTF-8 그대로
 *  - TXT:  UTF-8 그대로
 *
 * 반환:
 *  - text: 전체 텍스트 (페이지 사이엔 \n\n)
 *  - pageCount: PDF는 총 페이지 수, 그 외 1
 */

export type FileFormat = 'pdf' | 'docx' | 'md' | 'txt'

export type ExtractedText = {
  text: string
  pageCount: number
  format: FileFormat
}

export function detectFormat(
  fileName: string,
  mime?: string | null
): FileFormat | null {
  const lower = fileName.toLowerCase()
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf'
  if (
    mime ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    return 'docx'
  }
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md'
  if (
    mime === 'text/plain' ||
    mime === 'text/markdown' ||
    lower.endsWith('.txt')
  ) {
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md'
    return 'txt'
  }
  return null
}

export async function extractText(
  buffer: Buffer,
  format: FileFormat
): Promise<ExtractedText> {
  switch (format) {
    case 'pdf':
      return extractPdf(buffer)
    case 'docx':
      return extractDocx(buffer)
    case 'md':
    case 'txt':
      return extractPlainText(buffer, format)
  }
}

async function extractPdf(buffer: Buffer): Promise<ExtractedText> {
  const { extractText: extractPdfText, getDocumentProxy } = await import('unpdf')
  // Buffer → Uint8Array
  const data = new Uint8Array(buffer)
  const pdf = await getDocumentProxy(data)
  const result = await extractPdfText(pdf, { mergePages: true })
  const text = Array.isArray(result.text)
    ? result.text.join('\n\n')
    : (result.text ?? '')
  return {
    text: normalizeWhitespace(text),
    pageCount: result.totalPages ?? 1,
    format: 'pdf',
  }
}

async function extractDocx(buffer: Buffer): Promise<ExtractedText> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return {
    text: normalizeWhitespace(result.value),
    pageCount: 1,
    format: 'docx',
  }
}

async function extractPlainText(
  buffer: Buffer,
  format: 'md' | 'txt'
): Promise<ExtractedText> {
  const text = buffer.toString('utf8')
  return {
    text: normalizeWhitespace(text),
    pageCount: 1,
    format,
  }
}

/**
 * 추출된 텍스트의 과도한 공백·빈 줄 정리
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 토큰 수 추정 — Anthropic 한국어 기준 대략치
 *  영문은 문자 ÷ 4, 한글은 문자 ÷ 1.5 정도가 합리적 추정.
 *  엄밀한 카운팅이 필요하면 tiktoken/anthropic SDK의 실제 카운터 사용 권장.
 */
export function estimateTokens(text: string): number {
  let tokens = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code <= 0x7f) {
      tokens += 0.25 // ASCII ~ 4자 = 1 토큰
    } else {
      tokens += 0.7 // 한글/한자 ~ 1.4자 = 1 토큰
    }
  }
  return Math.ceil(tokens)
}
