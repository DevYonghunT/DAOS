'use client'

import { useState } from 'react'
import { GraduationCap, LayoutDashboard, ClipboardList } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProgramListTab } from './program-list-tab'
import { DashboardTab } from './dashboard-tab'
import { cn } from '@/lib/utils'

type Props = {
  initialAcademicYear: number
  canManage: boolean
  selfTeacherId: string
  availableYears: number[]
}

type Tab = 'programs' | 'dashboard'

export function ActivityClient({
  initialAcademicYear,
  canManage,
  selfTeacherId,
  availableYears,
}: Props) {
  const [tab, setTab] = useState<Tab>('programs')
  const [academicYear, setAcademicYear] = useState<number>(
    initialAcademicYear
  )

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-7xl mx-auto px-8 py-8">
        <header className="mb-6">
          <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
            <GraduationCap className="h-3.5 w-3.5" />
            세특입력활동 관리
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <h1 className="text-2xl font-bold text-[#1E293B]">
              {academicYear}학년도 활동 관리
            </h1>
            <Select
              value={String(academicYear)}
              onValueChange={(v) => setAcademicYear(Number(v))}
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}학년도
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* 탭 */}
        <div className="mb-5 border-b border-slate-200">
          <div className="flex gap-1">
            <TabButton
              active={tab === 'programs'}
              onClick={() => setTab('programs')}
              icon={<ClipboardList className="h-4 w-4" />}
            >
              프로그램 목록
            </TabButton>
            <TabButton
              active={tab === 'dashboard'}
              onClick={() => setTab('dashboard')}
              icon={<LayoutDashboard className="h-4 w-4" />}
            >
              학년별 참여현황
            </TabButton>
          </div>
        </div>

        {tab === 'programs' && (
          <ProgramListTab
            academicYear={academicYear}
            canManage={canManage}
            selfTeacherId={selfTeacherId}
          />
        )}
        {tab === 'dashboard' && <DashboardTab academicYear={academicYear} />}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition',
        active ? 'text-[#1E293B]' : 'text-[#64748B] hover:text-[#1E293B]'
      )}
    >
      {icon}
      {children}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6]" />
      )}
    </button>
  )
}
