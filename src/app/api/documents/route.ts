import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'

export const runtime = 'nodejs'

/**
 * GET /api/documents
 * 문서 목록 + 현재 버전 정보 + 청크 수
 */
export async function GET() {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: docs, error } = await supabase
    .from('documents')
    .select('id, title, category, uploaded_by, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const docIds = (docs ?? []).map((d) => d.id)
  if (docIds.length === 0) {
    return NextResponse.json({ documents: [] })
  }

  // 각 문서의 현재 버전
  const { data: versions } = await supabase
    .from('document_versions')
    .select('id, document_id, version, effective_date, is_current, uploaded_at')
    .in('document_id', docIds)
    .eq('is_current', true)

  const versionMap = new Map(
    (versions ?? []).map((v) => [v.document_id, v])
  )

  // 각 현재 버전의 청크 수
  const versionIds = (versions ?? []).map((v) => v.id)
  const chunkCountMap = new Map<string, number>()
  if (versionIds.length > 0) {
    const { data: chunks } = await supabase
      .from('document_chunks')
      .select('version_id')
      .in('version_id', versionIds)
    for (const c of chunks ?? []) {
      chunkCountMap.set(
        c.version_id,
        (chunkCountMap.get(c.version_id) ?? 0) + 1
      )
    }
  }

  // 업로더 이름
  const uploaderIds = Array.from(
    new Set((docs ?? []).map((d) => d.uploaded_by).filter(Boolean))
  ) as string[]
  const uploaderMap = new Map<string, string>()
  if (uploaderIds.length > 0) {
    const { data: teachers } = await supabase
      .from('teachers')
      .select('id, name')
      .in('id', uploaderIds)
    for (const t of teachers ?? []) {
      uploaderMap.set(t.id, t.name)
    }
  }

  const result = (docs ?? []).map((d) => {
    const v = versionMap.get(d.id)
    return {
      id: d.id,
      title: d.title,
      category: d.category,
      created_at: d.created_at,
      uploaded_by_name: d.uploaded_by
        ? uploaderMap.get(d.uploaded_by) ?? null
        : null,
      current_version: v
        ? {
            id: v.id,
            version: v.version,
            effective_date: v.effective_date,
            uploaded_at: v.uploaded_at,
            chunk_count: chunkCountMap.get(v.id) ?? 0,
          }
        : null,
    }
  })

  return NextResponse.json({ documents: result })
}
