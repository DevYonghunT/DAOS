import crypto from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

/**
 * 비식별화: 학생 실명 → 라벨 (학생A, 학생B, ...)
 *
 * 흐름:
 *  1. createMappings(names) → Map<실명, 라벨>
 *  2. deidentifyText(text, map) → 실명을 라벨로 치환한 문자열 (LLM에 전송)
 *  3. LLM 응답 받은 뒤 reidentifyText(response, map) → 라벨을 실명으로 복원
 *  4. 필요 시 saveMappings로 student_mappings 테이블에 암호화 저장
 */

export function createMappings(names: string[]): Map<string, string> {
  const unique = Array.from(new Set(names.filter(Boolean)))
  const map = new Map<string, string>()
  unique.forEach((name, i) => {
    const label = `학생${String.fromCharCode(0x41 + (i % 26))}${
      i >= 26 ? Math.floor(i / 26) : ''
    }`
    map.set(name, label)
  })
  return map
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function deidentifyText(
  text: string,
  mappings: Map<string, string>
): string {
  if (!mappings.size) return text
  // 긴 이름 먼저 치환 (부분일치 방지: "김철수" 전에 "김철" 치환되면 안 됨)
  const entries = [...mappings.entries()].sort(
    (a, b) => b[0].length - a[0].length
  )
  let result = text
  for (const [real, label] of entries) {
    result = result.replace(new RegExp(escapeRegExp(real), 'g'), label)
  }
  return result
}

export function reidentifyText(
  text: string,
  mappings: Map<string, string>
): string {
  if (!mappings.size) return text
  // label은 "학생A", "학생B" 형태라 부분일치 이슈 적음
  let result = text
  for (const [real, label] of mappings) {
    result = result.replace(new RegExp(escapeRegExp(label), 'g'), real)
  }
  return result
}

// ------------------------------------------------------------------
// 저장 / 로드 (AES-256-GCM)
// ------------------------------------------------------------------

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY는 64자 hex(32바이트)여야 합니다.')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptName(plain: string): Buffer {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // 저장 포맷: [iv(12) | tag(16) | ciphertext]
  return Buffer.concat([iv, tag, encrypted])
}

export function decryptName(blob: Buffer): string {
  const iv = blob.subarray(0, 12)
  const tag = blob.subarray(12, 28)
  const ciphertext = blob.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plain.toString('utf8')
}

export async function saveMappings(
  teacherId: string,
  mappings: Map<string, string>,
  gradeClass?: string
): Promise<void> {
  if (!mappings.size) return
  const supabase = await createClient()
  const rows = [...mappings.entries()].map(([real, label]) => ({
    teacher_id: teacherId,
    real_name_encrypted: encryptName(real),
    label,
    grade_class: gradeClass ?? null,
  }))
  const { error } = await supabase.from('student_mappings').insert(rows)
  if (error) throw error
}

export async function loadMappings(
  teacherId: string,
  gradeClass?: string
): Promise<Map<string, string>> {
  const supabase = await createClient()
  let query = supabase
    .from('student_mappings')
    .select('real_name_encrypted, label, grade_class')
    .eq('teacher_id', teacherId)
  if (gradeClass) query = query.eq('grade_class', gradeClass)
  const { data, error } = await query
  if (error) throw error
  const map = new Map<string, string>()
  for (const row of data ?? []) {
    const blob = Buffer.from(row.real_name_encrypted as unknown as Uint8Array)
    const real = decryptName(blob)
    map.set(real, row.label as string)
  }
  return map
}
