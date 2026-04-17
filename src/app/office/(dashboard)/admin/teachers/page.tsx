'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Shield, ShieldCheck, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Teacher = {
  id: string
  email: string
  name: string
  department: string | null
  role: string
  subject: string | null
  is_active: boolean
  created_at: string
}

const ROLE_OPTIONS = [
  { value: 'teacher', label: '교사', icon: User },
  { value: 'admin', label: '관리자', icon: Shield },
  { value: 'superadmin', label: '최고관리자', icon: ShieldCheck },
]

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/teachers')
      if (!res.ok) throw new Error()
      const json = await res.json()
      setTeachers(json.teachers ?? [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const changeRole = async (id: string, role: string) => {
    try {
      const res = await fetch(`/api/admin/teachers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error || '변경 실패')
        return
      }
      load()
    } catch {
      alert('변경 실패')
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-5xl mx-auto px-8 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-[#1E293B]">교사 관리</h1>
          <p className="text-sm text-[#64748B] mt-1">
            권한 변경, 부서·교과 관리. 대화 내용 접근은 RLS로 차단됩니다.
          </p>
        </header>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F6F3]">
              <tr className="text-left text-[11px] uppercase tracking-wider text-[#64748B]">
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">이메일</th>
                <th className="px-4 py-3">부서</th>
                <th className="px-4 py-3">교과</th>
                <th className="px-4 py-3 text-center">권한</th>
                <th className="px-4 py-3 text-center">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr><td colSpan={6} className="py-10 text-center text-[#64748B]">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />불러오는 중…
                </td></tr>
              )}
              {!loading && teachers.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-[#64748B]">
                  등록된 교사가 없습니다.
                </td></tr>
              )}
              {teachers.map((t) => (
                <tr key={t.id} className="hover:bg-[#F7F6F3]/60">
                  <td className="px-4 py-3 font-medium text-[#1E293B]">{t.name}</td>
                  <td className="px-4 py-3 text-xs text-[#64748B]">{t.email}</td>
                  <td className="px-4 py-3 text-[#475569]">{t.department ?? '-'}</td>
                  <td className="px-4 py-3 text-[#475569]">{t.subject ?? '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <Select value={t.role} onValueChange={(v) => changeRole(t.id, v)}>
                      <SelectTrigger className="h-8 w-[140px] text-xs mx-auto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className={cn('text-[10px]',
                      t.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                    )}>
                      {t.is_active ? '활성' : '비활성'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
