'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { GraduationCap, LogOut } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { NAV_ITEMS } from '@/components/dashboard/nav-config'
import { cn } from '@/lib/utils'

type SidebarProps = {
  teacherName: string
  teacherEmail: string
  teacherAvatarUrl?: string | null
  isAdmin: boolean
}

export function Sidebar({
  teacherName,
  teacherEmail,
  teacherAvatarUrl,
  isAdmin,
}: SidebarProps) {
  const pathname = usePathname()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/office/login'
  }

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <aside className="w-64 bg-[#1B2A4A] text-white flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-white/10">
        <p className="text-[10px] text-white/50 tracking-wider leading-none mb-1">DUKSOO HighSchool</p>
        <h1 className="text-sm font-semibold leading-tight">
          AI 온라인 교무실
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {items.map((item) => {
            const isActive =
              item.href === '/office'
                ? pathname === '/office'
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r bg-[#3B82F6]" />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-9 w-9">
            {teacherAvatarUrl && (
              <AvatarImage src={teacherAvatarUrl} alt={teacherName} />
            )}
            <AvatarFallback className="bg-white/15 text-white text-sm">
              {teacherName.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{teacherName}</p>
            <p className="text-xs text-white/50 truncate">{teacherEmail}</p>
          </div>
        </div>
        <Link
          href="/classroom"
          className="w-full inline-flex items-center justify-start gap-2 rounded-md px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white transition mb-1"
        >
          <GraduationCap className="h-4 w-4" />
          AI 교실로 이동
        </Link>
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-white/70 hover:bg-white/5 hover:text-white text-sm h-9"
        >
          <LogOut className="h-4 w-4 mr-2" />
          로그아웃
        </Button>
      </div>
    </aside>
  )
}
