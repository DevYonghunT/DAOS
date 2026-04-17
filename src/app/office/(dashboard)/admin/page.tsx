import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FileText, Settings, Users, BarChart3, ScrollText, GraduationCap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole, isAdmin } from '@/lib/auth/teacher'

export const dynamic = 'force-dynamic'

const ADMIN_LINKS = [
  {
    href: '/office/admin/documents',
    icon: FileText,
    title: '문서 관리',
    description: '학교 규정·계획서 업로드, 버전 관리, 청크 미리보기',
    available: true,
  },
  {
    href: '/office/admin/teachers',
    icon: Users,
    title: '교사 관리',
    description: '교사 권한 변경(superadmin/admin/teacher), 활성 상태 관리',
    available: true,
  },
  {
    href: '/office/admin/students',
    icon: GraduationCap,
    title: '학생 관리',
    description: 'CSV 일괄 등록, 학년도별 소속 관리',
    available: true,
  },
  {
    href: '/office/admin/usage',
    icon: BarChart3,
    title: '사용량 통계',
    description: '교사별 AI 사용량, 비용, 캐시 효율 추적',
    available: true,
  },
  {
    href: '/office/admin/audit',
    icon: ScrollText,
    title: '감사 로그',
    description: '관리자 행위 추적: 권한 변경, CSV 임포트, 문서 업로드',
    available: true,
  },
]

export default async function AdminPage() {
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher || !isAdmin(teacher)) redirect('/office')

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-5xl mx-auto px-8 py-10">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
            <Settings className="h-3.5 w-3.5" />
            관리자
          </div>
          <h1 className="text-2xl font-bold text-[#1E293B]">관리자 설정</h1>
          <p className="text-sm text-[#64748B] mt-1">
            관리자({teacher.role})만 접근 가능한 영역입니다.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ADMIN_LINKS.map((l) => {
            const Icon = l.icon
            const cardCls = l.available
              ? 'group bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-[#3B82F6]/40 hover:shadow-md transition-all'
              : 'bg-white/60 rounded-xl border border-dashed border-slate-200 p-5 opacity-60'
            const content = (
              <div className="flex items-start gap-3">
                <div
                  className={
                    l.available
                      ? 'h-10 w-10 rounded-lg bg-[#EEF4FF] text-[#3B82F6] flex items-center justify-center shrink-0 group-hover:bg-[#3B82F6] group-hover:text-white transition-colors'
                      : 'h-10 w-10 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0'
                  }
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#1E293B] mb-0.5 inline-flex items-center gap-2">
                    {l.title}
                    {!l.available && (
                      <span className="text-[10px] uppercase tracking-wide text-[#94A3B8] bg-slate-100 px-1.5 py-0.5 rounded">
                        준비 중
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {l.description}
                  </p>
                </div>
              </div>
            )
            return l.available ? (
              <Link key={l.title} href={l.href} className={cardCls}>
                {content}
              </Link>
            ) : (
              <div key={l.title} className={cardCls}>
                {content}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
