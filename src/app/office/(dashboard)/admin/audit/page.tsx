'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, ScrollText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type AuditLog = {
  id: string
  actor_id: string
  actor_name: string
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  role_change: { label: '권한 변경', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  csv_import: { label: '학생 CSV', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  document_upload: { label: '문서 업로드', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  student_bulk_create: { label: '학생 등록', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (actionFilter !== 'all') params.set('action', actionFilter)
      const res = await fetch(`/api/admin/audit?${params.toString()}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setLogs(json.logs ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [actionFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-[#1E293B] inline-flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-[#3B82F6]" />
            감사 로그
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            관리자 행위를 추적합니다. 권한 변경, CSV 임포트, 문서 업로드 등.
          </p>
        </header>

        <div className="mb-4 flex items-center gap-2">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 액션</SelectItem>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load}>
            새로고침
          </Button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F6F3]">
              <tr className="text-left text-[11px] uppercase tracking-wider text-[#64748B]">
                <th className="px-4 py-3">일시</th>
                <th className="px-4 py-3">행위자</th>
                <th className="px-4 py-3">액션</th>
                <th className="px-4 py-3">대상</th>
                <th className="px-4 py-3">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={5} className="py-10 text-center text-[#64748B]">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />불러오는 중…
                </td></tr>
              )}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-[#64748B]">
                  감사 로그가 없습니다.
                </td></tr>
              )}
              {logs.map((l) => {
                const actionMeta = ACTION_LABELS[l.action]
                return (
                  <tr key={l.id} className="hover:bg-[#F7F6F3]/60">
                    <td className="px-4 py-3 font-mono text-xs text-[#64748B] whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#1E293B]">{l.actor_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn('text-[10px] font-normal', actionMeta?.color ?? 'bg-slate-100 text-slate-700 border-slate-200')}>
                        {actionMeta?.label ?? l.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">
                      {l.target_type ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#475569] max-w-[300px] truncate">
                      {l.details ? JSON.stringify(l.details).slice(0, 100) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
