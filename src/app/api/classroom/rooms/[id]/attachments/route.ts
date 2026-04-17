import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserContext, isTeacher } from '@/lib/auth/context'
import { detectFormat, extractText, estimateTokens } from '@/lib/documents/extract'

export const runtime = 'nodejs'
export const maxDuration = 120

type Params = { params: Promise<{ id: string }> }

/** GET /api/classroom/rooms/:id/attachments */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('room_attachments')
    .select('id, filename, file_type, file_size, token_count, created_at')
    .eq('room_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ attachments: data ?? [] })
}

/** POST /api/classroom/rooms/:id/attachments — 파일 업로드 (교사만) */
export async function POST(req: Request, { params }: Params) {
  const { id: roomId } = await params
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx || !isTeacher(ctx)) {
    return NextResponse.json({ error: 'teachers_only' }, { status: 403 })
  }

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'invalid_form' }, { status: 400 }) }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 })
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'file_too_large', message: '20MB 이하' }, { status: 400 })
  }

  const format = detectFormat(file.name, file.type)
  if (!format) {
    return NextResponse.json({ error: 'unsupported_format' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // 텍스트 추출
  let fullText = ''
  try {
    const extracted = await extractText(buffer, format)
    fullText = extracted.text
  } catch (err) {
    return NextResponse.json({
      error: 'extract_failed',
      message: err instanceof Error ? err.message : '추출 실패',
    }, { status: 500 })
  }

  const tokenCount = estimateTokens(fullText)

  // Storage 업로드
  const safeName = file.name.replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, '_') || `file_${Date.now()}`
  const storagePath = `${roomId}/${Date.now()}_${safeName}`

  const { error: stErr } = await supabase.storage
    .from('room-attachments')
    .upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
    })
  if (stErr) {
    return NextResponse.json({ error: `Storage 실패: ${stErr.message}` }, { status: 500 })
  }

  // DB 저장
  const { data: att, error: dbErr } = await supabase
    .from('room_attachments')
    .insert({
      room_id: roomId,
      filename: file.name,
      storage_path: storagePath,
      file_type: format,
      file_size: file.size,
      full_text: fullText,
      token_count: tokenCount,
      uploaded_by: ctx.profile.id,
    })
    .select('id, filename, token_count')
    .single()

  if (dbErr || !att) {
    return NextResponse.json({ error: dbErr?.message ?? 'db_failed' }, { status: 500 })
  }

  // 시스템 메시지
  await supabase.from('room_messages').insert({
    room_id: roomId,
    sender_type: 'system',
    content: `📎 ${ctx.profile.name} 선생님이 "${file.name}"을 업로드했습니다.`,
  })

  return NextResponse.json({ attachment: att }, { status: 201 })
}
