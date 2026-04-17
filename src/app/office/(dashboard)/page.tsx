import Image from 'next/image'
import { DashboardCalendar } from './dashboard-calendar'

export default async function HomePage() {
  return (
    <div className="h-screen overflow-hidden bg-[#F7F6F3] flex flex-col">
      <div className="max-w-6xl w-full mx-auto px-6 pt-4 pb-2 flex flex-col h-full min-h-0">
        {/* 교표 + 환영 — 컴팩트 한 줄 */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-4 mb-3 shrink-0">
          <div className="flex items-center gap-4">
            <Image
              src="/duksoo-logo.png"
              alt="덕수고등학교 교표"
              width={128}
              height={128}
              priority
              unoptimized
              className="h-12 w-12 object-contain shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-[#1E293B] leading-tight">
                덕수고등학교 AI 온라인 교무실
              </h1>
              <p className="text-xs text-[#64748B] mt-0.5">
                수업 준비부터 세특 작성, 일정 관리까지 — 교무 업무를 한 곳에서.
              </p>
            </div>
          </div>
        </section>

        {/* 달력 — 나머지 공간 전부 */}
        <div className="flex-1 min-h-0">
          <DashboardCalendar />
        </div>
      </div>
    </div>
  )
}
