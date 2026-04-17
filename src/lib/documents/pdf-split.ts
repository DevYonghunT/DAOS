import 'server-only'
import { PDFDocument } from 'pdf-lib'

const MAX_PAGES_PER_CHUNK = 100

export type PdfChunkInfo = {
  /** 0-based 청크 인덱스 */
  index: number
  /** 시작 페이지 (1-based, 포함) */
  startPage: number
  /** 끝 페이지 (1-based, 포함) */
  endPage: number
  /** 이 청크의 PDF 바이트 */
  buffer: Buffer
  /** 이 청크 페이지 수 */
  pageCount: number
}

/**
 * PDF가 maxPages 초과이면 maxPages 단위로 분할.
 * maxPages 이하이면 원본 그대로 1개 청크로 반환.
 */
export async function splitPdfIfNeeded(
  buffer: Buffer,
  maxPages: number = MAX_PAGES_PER_CHUNK
): Promise<PdfChunkInfo[]> {
  const src = await PDFDocument.load(buffer, { ignoreEncryption: true })
  const total = src.getPageCount()

  if (total <= maxPages) {
    return [
      {
        index: 0,
        startPage: 1,
        endPage: total,
        buffer,
        pageCount: total,
      },
    ]
  }

  const chunks: PdfChunkInfo[] = []
  let start = 0

  while (start < total) {
    const end = Math.min(start + maxPages, total)
    const newDoc = await PDFDocument.create()
    const pageIndices = Array.from(
      { length: end - start },
      (_, i) => start + i
    )
    const pages = await newDoc.copyPages(src, pageIndices)
    pages.forEach((p) => newDoc.addPage(p))

    const bytes = await newDoc.save()
    chunks.push({
      index: chunks.length,
      startPage: start + 1,
      endPage: end,
      buffer: Buffer.from(bytes),
      pageCount: end - start,
    })
    start = end
  }

  return chunks
}

/**
 * PDF 전체 페이지 수만 빠르게 확인
 */
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
  return doc.getPageCount()
}
