'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Upload as UploadIcon,
  Trash2,
  ChevronDown,
  ChevronRight,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UploadDocumentDialog } from './upload-dialog'
import { cn } from '@/lib/utils'

type DocSummary = {
  id: string
  title: string
  category: string
  created_at: string
  uploaded_by_name: string | null
  current_version: null | {
    id: string
    version: number
    effective_date: string | null
    uploaded_at: string
    chunk_count: number
  }
}

type DocDetail = {
  document: {
    id: string
    title: string
    category: string
    uploaded_by: string | null
    created_at: string
  }
  versions: Array<{
    id: string
    version: number
    storage_path: string | null
    effective_date: string | null
    is_current: boolean
    uploaded_at: string
  }>
  current_chunks: Array<{
    id: string
    chunk_index: number
    heading: string | null
    content: string
    page_no: number | null
    token_count: number | null
  }>
}

const CATEGORY_LABELS: Record<string, string> = {
  regulation: '규정',
  plan: '계획서',
  assignment: '업무분장',
  calendar: '학사일정',
  other: '기타',
}

export function DocumentsClient() {
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [versionTargetDoc, setVersionTargetDoc] = useState<DocSummary | null>(
    null
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DocDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/documents')
      if (!res.ok) throw new Error()
      const json = (await res.json()) as { documents: DocSummary[] }
      setDocs(json.documents)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const loadDetail = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(id)
    setDetail(null)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/documents/${id}`)
      if (!res.ok) throw new Error()
      setDetail(await res.json())
    } catch {
      /* ignore */
    } finally {
      setDetailLoading(false)
    }
  }

  const handleUploaded = () => {
    load()
    if (expandedId) {
      void loadDetail(expandedId).then(() => {
        // re-expand
        setExpandedId((prev) => prev)
      })
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (
      !confirm(
        `"${title}" 문서를 모든 버전·청크와 함께 삭제할까요? 되돌릴 수 없습니다.`
      )
    )
      return
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message || j.error || '삭제 실패')
      }
      if (expandedId === id) {
        setExpandedId(null)
        setDetail(null)
      }
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제 실패')
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-6xl mx-auto px-8 py-8">
        <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
              <FileText className="h-3.5 w-3.5" />
              관리자 · 문서 관리
            </div>
            <h1 className="text-2xl font-bold text-[#1E293B]">
              학교 규정 · 계획서
            </h1>
            <p className="text-sm text-[#64748B] mt-1">
              업로드된 문서는 자동으로 텍스트 추출 + 청크 분할 후 학교 규정 안내 챗봇에서 인용됩니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load}>
              <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
              새로고침
            </Button>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-[#3B82F6] hover:bg-[#2563EB]"
            >
              <Plus className="h-4 w-4 mr-1" />새 문서 업로드
            </Button>
          </div>
        </header>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F6F3]">
              <tr className="text-left text-[11px] uppercase tracking-wider text-[#64748B]">
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">제목</th>
                <th className="px-4 py-3">분류</th>
                <th className="px-4 py-3 text-center">현재 버전</th>
                <th className="px-4 py-3">시행일</th>
                <th className="px-4 py-3 text-center">청크</th>
                <th className="px-4 py-3">업로더</th>
                <th className="px-4 py-3 text-right">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && docs.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-[#64748B]">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    불러오는 중…
                  </td>
                </tr>
              )}
              {!loading && docs.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-[#64748B]">
                    등록된 문서가 없습니다. 첫 문서를 업로드하세요.
                  </td>
                </tr>
              )}
              {docs.map((d) => (
                <RowGroup
                  key={d.id}
                  doc={d}
                  expanded={expandedId === d.id}
                  detail={expandedId === d.id ? detail : null}
                  detailLoading={expandedId === d.id && detailLoading}
                  onToggle={() => loadDetail(d.id)}
                  onNewVersion={() => setVersionTargetDoc(d)}
                  onDelete={() => handleDelete(d.id, d.title)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <UploadDocumentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onUploaded={handleUploaded}
      />
      <UploadDocumentDialog
        open={versionTargetDoc !== null}
        onOpenChange={(v) => {
          if (!v) setVersionTargetDoc(null)
        }}
        existingDocument={versionTargetDoc}
        onUploaded={handleUploaded}
      />
    </div>
  )
}

function RowGroup({
  doc,
  expanded,
  detail,
  detailLoading,
  onToggle,
  onNewVersion,
  onDelete,
}: {
  doc: DocSummary
  expanded: boolean
  detail: DocDetail | null
  detailLoading: boolean
  onToggle: () => void
  onNewVersion: () => void
  onDelete: () => void
}) {
  return (
    <>
      <tr className="hover:bg-[#F7F6F3]/60">
        <td className="px-4 py-3 w-8">
          <button
            type="button"
            onClick={onToggle}
            className="text-[#94A3B8] hover:text-[#1E293B]"
            aria-label="상세 보기"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </td>
        <td className="px-4 py-3 font-medium text-[#1E293B]">{doc.title}</td>
        <td className="px-4 py-3">
          <Badge
            variant="outline"
            className="text-[10px] font-normal bg-slate-100 text-slate-700 border-slate-200"
          >
            {CATEGORY_LABELS[doc.category] ?? doc.category}
          </Badge>
        </td>
        <td className="px-4 py-3 text-center text-xs">
          {doc.current_version ? (
            <span className="inline-flex items-center justify-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5">
              v{doc.current_version.version}
            </span>
          ) : (
            <span className="text-[#94A3B8]">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs text-[#475569]">
          {doc.current_version?.effective_date ?? '-'}
        </td>
        <td className="px-4 py-3 text-center text-xs">
          {doc.current_version?.chunk_count ?? 0}
        </td>
        <td className="px-4 py-3 text-xs text-[#64748B]">
          {doc.uploaded_by_name ?? '-'}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="inline-flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={onNewVersion}
            >
              <UploadIcon className="h-3 w-3 mr-1" />새 버전
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-700"
              onClick={onDelete}
              aria-label="삭제"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-[#F7F6F3]/40">
          <td colSpan={8} className="px-6 py-4">
            {detailLoading && (
              <p className="text-xs text-[#64748B] inline-flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                상세 로딩 중…
              </p>
            )}
            {detail && (
              <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
                {/* 버전 이력 */}
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#94A3B8] mb-2">
                    버전 이력
                  </p>
                  <ul className="space-y-1">
                    {detail.versions.map((v) => (
                      <li
                        key={v.id}
                        className={cn(
                          'rounded-md border px-3 py-2 text-xs flex items-center justify-between',
                          v.is_current
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-slate-200 bg-white text-[#64748B]'
                        )}
                      >
                        <span>
                          v{v.version}
                          {v.is_current && (
                            <Badge
                              variant="outline"
                              className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200"
                            >
                              현재
                            </Badge>
                          )}
                        </span>
                        <span className="text-[10px] text-[#94A3B8]">
                          {v.effective_date ?? v.uploaded_at.slice(0, 10)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 청크 미리보기 */}
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[#94A3B8] mb-2 inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    현재 버전 청크 ({detail.current_chunks.length})
                  </p>
                  {detail.current_chunks.length === 0 ? (
                    <p className="text-xs text-[#64748B]">청크가 없습니다.</p>
                  ) : (
                    <ul className="space-y-2 max-h-[420px] overflow-y-auto">
                      {detail.current_chunks.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-md border border-slate-200 bg-white px-3 py-2"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-semibold text-[#1E293B]">
                              {c.heading ?? `청크 #${c.chunk_index + 1}`}
                            </p>
                            <span className="text-[10px] text-[#94A3B8]">
                              {c.token_count ?? 0} tok
                            </span>
                          </div>
                          <p className="text-xs text-[#475569] whitespace-pre-wrap line-clamp-6">
                            {c.content}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
