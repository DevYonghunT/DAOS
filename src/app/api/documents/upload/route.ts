import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'
import { detectFormat, extractText } from '@/lib/documents/extract'
import { chunkDocument } from '@/lib/documents/chunker'
import { uploadDocumentFile } from '@/lib/documents/storage'
import { splitPdfIfNeeded } from '@/lib/documents/pdf-split'
import { MODELS, type ModelId } from '@/lib/ai/models'
import { getAnthropic } from '@/lib/ai/client'
import { generateText } from 'ai'
import { logUsage } from '@/lib/ai/usage'

export const runtime = 'nodejs'
export const maxDuration = 600 // 10분 — 대용량 PDF 분할 + rate limit throttle 대기

const ALLOWED_CATEGORIES = [
  'regulation', 'plan', 'assignment', 'calendar', 'other',
] as const
type Category = (typeof ALLOWED_CATEGORIES)[number]
function isCategory(v: string): v is Category {
  return (ALLOWED_CATEGORIES as readonly string[]).includes(v)
}

const AI_SYSTEM = `너는 PDF 문서를 **원문의 구조와 내용을 정확히 보존**하면서 Markdown으로 변환하는 전문가다.
규칙: 원문 그대로 옮김. 장→#, 절→##, 조항→###, 표→파이프, 목록→-/1. 페이지 노이즈 제외. 한국어 유지. 설명 없이 Markdown만 출력.`

/**
 * POST /api/documents/upload (multipart/form-data)
 *
 * AI 변환 시 SSE로 진행률을 실시간 스트리밍:
 *   event: progress
 *   data: {"step":"extracting","percent":10,"message":"텍스트 추출 중..."}
 *
 *   event: progress
 *   data: {"step":"converting","percent":40,"message":"AI 변환 중 (2/3)...","detail":"101~200페이지"}
 *
 *   event: done
 *   data: {"document_id":"...","version":2,"chunk_count":45,...}
 *
 *   event: error
 *   data: {"message":"..."}
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isAdmin(teacher)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 })
  }

  const file = form.get('file')
  const title = (form.get('title') as string | null)?.trim() ?? ''
  const category = (form.get('category') as string | null) ?? ''
  const effectiveDate = (form.get('effective_date') as string | null) ?? null
  const existingDocId = (form.get('document_id') as string | null)?.trim() || null
  const convertWithAi = form.get('convert_with_ai') === 'true'
  const aiModel = ((form.get('ai_model') as string | null)?.trim() || 'claude-haiku-4-5') as ModelId

  // 유효성 검사 (SSE 전에 먼저)
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 })
  }
  if (!title) {
    return NextResponse.json({ error: 'title_required' }, { status: 400 })
  }
  if (!isCategory(category)) {
    return NextResponse.json({ error: 'invalid_category' }, { status: 400 })
  }
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 })
  }
  const format = detectFormat(file.name, file.type)
  if (!format) {
    return NextResponse.json({ error: 'unsupported_format' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // SSE 스트림 생성
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      try {
        // ── 1단계: 텍스트 추출 ────────────────────────────
        send('progress', { step: 'extracting', percent: 5, message: '텍스트 추출 준비 중...' })

        let fullText: string
        let pageCount = 1
        let conversionMeta: Record<string, unknown> = { converted: false }

        if (format === 'pdf' && convertWithAi) {
          // PDF 분할 + AI 변환
          send('progress', { step: 'splitting', percent: 8, message: 'PDF 페이지 수 확인 중...' })
          // 50페이지 단위 분할 (이미지 많은 PDF는 페이지당 ~2k 토큰 → 50p ≈ 100k 토큰으로 안전)
          const pdfChunks = await splitPdfIfNeeded(buffer, 50)
          const totalChunks = pdfChunks.length
          pageCount = pdfChunks.reduce((a, c) => a + c.pageCount, 0)

          send('progress', {
            step: 'converting',
            percent: 10,
            message: `총 ${pageCount}페이지, ${totalChunks > 1 ? `${totalChunks}개 파트로 나눠서 ` : ''}AI 변환 시작...`,
          })

          const anthropic = getAnthropic()
          const modelDef = MODELS[aiModel]
          const mdParts: string[] = []
          let totalIn = 0
          let totalOut = 0
          const startTime = Date.now()

          for (let i = 0; i < pdfChunks.length; i++) {
            const chunk = pdfChunks[i]
            const pctBase = 10
            const pctRange = 70
            const pctPerChunk = pctRange / totalChunks
            const currentPct = Math.round(pctBase + pctPerChunk * i)

            // Rate limit throttle: 2번째 청크부터 65초 대기 (분당 토큰 한도 보호)
            if (i > 0) {
              const waitSec = 65
              send('progress', {
                step: 'converting',
                percent: currentPct,
                message: `API 한도 대기 중 (${waitSec}초)... 이후 파트 ${i + 1}/${totalChunks} 시작`,
                detail: `분당 토큰 한도 보호를 위해 대기합니다`,
              })
              await new Promise((r) => setTimeout(r, waitSec * 1000))
            }

            send('progress', {
              step: 'converting',
              percent: currentPct,
              message: totalChunks > 1
                ? `AI 변환 중 (${i + 1}/${totalChunks})...`
                : 'AI 변환 중...',
              detail: totalChunks > 1
                ? `${chunk.startPage}~${chunk.endPage}페이지 처리 중`
                : `${pageCount}페이지 처리 중`,
            })

            const result = await generateText({
              model: anthropic(aiModel),
              system: AI_SYSTEM,
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'file',
                      data: chunk.buffer,
                      mediaType: 'application/pdf',
                      filename: file.name,
                    },
                    {
                      type: 'text',
                      text: totalChunks > 1
                        ? `이 PDF는 전체 문서의 ${chunk.startPage}~${chunk.endPage}페이지 부분입니다. 이 범위만 Markdown으로 변환하세요.`
                        : '이 PDF 문서를 구조를 보존한 Markdown으로 변환해줘.',
                    },
                  ],
                },
              ],
              maxOutputTokens: modelDef?.maxOutput ?? 8192,
              maxRetries: 2,
            })

            mdParts.push(result.text?.trim() ?? '')
            totalIn += result.usage?.inputTokens ?? 0
            totalOut += result.usage?.outputTokens ?? 0

            send('progress', {
              step: 'converting',
              percent: Math.round(pctBase + pctPerChunk * (i + 1)),
              message: totalChunks > 1
                ? `AI 변환 완료 (${i + 1}/${totalChunks})`
                : 'AI 변환 완료',
              detail: `${chunk.startPage}~${chunk.endPage}페이지 완료`,
            })
          }

          fullText = totalChunks === 1
            ? mdParts[0]
            : mdParts
                .map((md, i) => `<!-- Part ${i + 1}: p.${pdfChunks[i].startPage}~${pdfChunks[i].endPage} -->\n\n${md}`)
                .join('\n\n---\n\n')

          const latencyMs = Date.now() - startTime
          await logUsage({
            teacherId: teacher.id,
            feature: 'rules',
            model: aiModel,
            tokensInput: totalIn,
            tokensOutput: totalOut,
            latencyMs,
            status: 'success',
            cacheHit: false,
            cacheReadTokens: 0,
          })

          conversionMeta = {
            converted: true,
            model: aiModel,
            tokensInput: totalIn,
            tokensOutput: totalOut,
            latencyMs,
            chunksProcessed: totalChunks,
            totalPages: pageCount,
          }
        } else {
          // 기본 추출 (unpdf / mammoth / plain)
          send('progress', { step: 'extracting', percent: 20, message: '텍스트 추출 중...' })
          const extracted = await extractText(buffer, format)
          fullText = extracted.text
          pageCount = extracted.pageCount
        }

        if (!fullText || fullText.length < 20) {
          send('error', { message: '추출된 텍스트가 너무 짧습니다. 스캔 PDF면 OCR이 필요합니다.' })
          controller.close()
          return
        }

        // ── 2단계: 청크 분할 ────────────────────────────
        send('progress', { step: 'chunking', percent: 82, message: '문서 청크 분할 중...' })
        const chunks = chunkDocument(fullText)
        if (chunks.length === 0) {
          send('error', { message: '청크 분할 결과가 비어 있습니다.' })
          controller.close()
          return
        }

        // ── 3단계: DB 저장 ──────────────────────────────
        send('progress', { step: 'saving', percent: 88, message: 'DB에 문서 저장 중...' })

        let documentId = existingDocId
        if (!documentId) {
          const { data: doc, error: docErr } = await supabase
            .from('documents')
            .insert({ title, category, uploaded_by: teacher.id })
            .select('id')
            .single()
          if (docErr || !doc) {
            send('error', { message: `문서 생성 실패: ${docErr?.message}` })
            controller.close()
            return
          }
          documentId = doc.id
        } else {
          const { data: existing } = await supabase
            .from('documents')
            .select('id')
            .eq('id', documentId)
            .maybeSingle()
          if (!existing) {
            send('error', { message: '기존 문서를 찾을 수 없습니다.' })
            controller.close()
            return
          }
        }

        // 다음 version 번호
        const { data: lastVer } = await supabase
          .from('document_versions')
          .select('version')
          .eq('document_id', documentId)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle()
        const newVersion = (lastVer?.version ?? 0) + 1

        // Storage 업로드
        send('progress', { step: 'storing', percent: 91, message: '파일 스토리지 업로드 중...' })
        const defaultMime = format === 'pdf' ? 'application/pdf'
          : format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : format === 'md' ? 'text/markdown' : 'text/plain'

        let storagePath: string
        try {
          const uploaded = await uploadDocumentFile(supabase, {
            documentId: documentId!,
            version: newVersion,
            fileName: file.name,
            contentType: file.type || defaultMime,
            bytes: buffer,
          })
          storagePath = uploaded.path
        } catch (stErr) {
          send('error', { message: `Storage 업로드 실패: ${stErr instanceof Error ? stErr.message : 'unknown'}` })
          controller.close()
          return
        }

        // 이전 버전 비활성화
        await supabase
          .from('document_versions')
          .update({ is_current: false })
          .eq('document_id', documentId)

        // 새 버전 INSERT
        send('progress', { step: 'saving', percent: 94, message: '버전 및 청크 저장 중...' })
        const { data: version, error: vErr } = await supabase
          .from('document_versions')
          .insert({
            document_id: documentId,
            version: newVersion,
            storage_path: storagePath,
            effective_date: effectiveDate || null,
            is_current: true,
            full_text: fullText,
          })
          .select('id')
          .single()

        if (vErr || !version) {
          send('error', { message: `버전 저장 실패: ${vErr?.message}` })
          controller.close()
          return
        }

        // 청크 INSERT
        const chunkRows = chunks.map((c) => ({
          version_id: version.id,
          chunk_index: c.index,
          heading: c.heading,
          content: c.content,
          page_no: c.pageNo,
          token_count: c.tokenCount,
        }))
        const { error: chunkErr } = await supabase
          .from('document_chunks')
          .insert(chunkRows)
        if (chunkErr) {
          send('error', { message: `청크 저장 실패: ${chunkErr.message}` })
          controller.close()
          return
        }

        // ── 완료 ────────────────────────────────────────
        send('progress', { step: 'done', percent: 100, message: '업로드 완료!' })
        send('done', {
          document_id: documentId,
          version_id: version.id,
          version: newVersion,
          page_count: pageCount,
          chunk_count: chunks.length,
          total_tokens: chunks.reduce((a, c) => a + c.tokenCount, 0),
          text_length: fullText.length,
          ai_conversion: conversionMeta,
        })
      } catch (err) {
        console.error('[api/documents/upload] 전체 오류:', err)
        send('error', {
          message: err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
