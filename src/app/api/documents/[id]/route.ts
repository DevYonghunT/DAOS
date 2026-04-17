import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** GET /api/documents/:id — 문서 + 모든 버전 + 현재 버전의 청크 미리보기 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, title, category, uploaded_by, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!doc) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { data: versions } = await supabase
    .from('document_versions')
    .select('id, version, storage_path, effective_date, is_current, uploaded_at')
    .eq('document_id', id)
    .order('version', { ascending: false })

  const currentVersion = (versions ?? []).find((v) => v.is_current)
  let chunks: Array<{
    id: string
    chunk_index: number
    heading: string | null
    content: string
    page_no: number | null
    token_count: number | null
  }> = []
  if (currentVersion) {
    const { data: ch } = await supabase
      .from('document_chunks')
      .select('id, chunk_index, heading, content, page_no, token_count')
      .eq('version_id', currentVersion.id)
      .order('chunk_index', { ascending: true })
    chunks = ch ?? []
  }

  return NextResponse.json({
    document: doc,
    versions: versions ?? [],
    current_chunks: chunks,
  })
}

/** DELETE /api/documents/:id — 문서 전체 삭제 (관리자만) */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!isAdmin(teacher)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // 참고: storage 객체는 DB CASCADE만으로 자동 삭제되지 않음.
  // 대용량 파일을 정기 정리하려면 별도 정리 잡 필요. (Phase 5 MVP 범위 외)
  return NextResponse.json({ ok: true })
}
