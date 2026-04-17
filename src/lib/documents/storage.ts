import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Supabase Storage 버킷명 */
export const DOCUMENT_BUCKET = 'documents'

export type UploadedFile = {
  path: string
  size: number
}

/**
 * 문서 파일을 Storage에 업로드.
 * 경로 규약: documents/{document_id}/{version}/{safeFileName}
 *
 * 호출 전 버킷이 존재해야 함. ensureBucketExists()로 보장 가능.
 */
export async function uploadDocumentFile(
  supabase: SupabaseClient,
  args: {
    documentId: string
    version: number
    fileName: string
    contentType: string
    bytes: Buffer
  }
): Promise<UploadedFile> {
  const safeName = sanitizeFileName(args.fileName)
  const path = `${args.documentId}/v${args.version}/${safeName}`

  const { error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(path, args.bytes, {
      contentType: args.contentType,
      upsert: false,
    })

  if (error) {
    throw new Error(`Storage 업로드 실패: ${error.message}`)
  }

  return { path, size: args.bytes.length }
}

/**
 * 버킷이 없으면 비공개로 생성. (관리자 service_role 또는 적절한 권한 필요)
 * 일반 anon 클라이언트로는 실패할 수 있으니 첫 1회만 setup으로.
 */
export async function ensureBucketExists(
  supabase: SupabaseClient
): Promise<{ created: boolean }> {
  const { data: buckets } = await supabase.storage.listBuckets()
  if (buckets?.some((b) => b.name === DOCUMENT_BUCKET)) {
    return { created: false }
  }
  const { error } = await supabase.storage.createBucket(DOCUMENT_BUCKET, {
    public: false,
  })
  if (error) {
    throw new Error(`버킷 생성 실패: ${error.message}`)
  }
  return { created: true }
}

/**
 * 다운로드용 시간 제한 URL 생성 (1시간)
 */
export async function createSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSec = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(storagePath, expiresInSec)
  if (error || !data?.signedUrl) {
    throw new Error(`서명 URL 생성 실패: ${error?.message ?? 'unknown'}`)
  }
  return data.signedUrl
}

function sanitizeFileName(name: string): string {
  // Supabase Storage는 한글/비ASCII 키를 거부하므로 URL-encode 처리
  const cleaned = name
    .replace(/[\/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200)
  // 비ASCII 문자가 있으면 타임스탬프 기반 안전 이름 + 원본 확장자
  const hasNonAscii = /[^\x00-\x7F]/.test(cleaned)
  if (hasNonAscii) {
    const ext = cleaned.includes('.') ? cleaned.slice(cleaned.lastIndexOf('.')) : ''
    return `doc_${Date.now()}${ext}`
  }
  return cleaned
}
