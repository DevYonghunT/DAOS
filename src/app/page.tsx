import Image from 'next/image'
import Link from 'next/link'
import { GraduationCap, School } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F7F6F3] flex flex-col">
      {/* 메인 */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-3xl w-full text-center">
          {/* 교표 + 타이틀 */}
          <div className="mb-10">
            <Image
              src="/duksoo-logo.png"
              alt="덕수고등학교 교표"
              width={256}
              height={256}
              priority
              unoptimized
              className="h-72 w-72 mx-auto mb-4 object-contain drop-shadow-sm"
            />
            <p className="text-[11px] tracking-[0.25em] text-[#1B2A4A]/60 mb-2">
              DUKSOO HIGH SCHOOL · SINCE 1910
            </p>
            <h1 className="text-3xl font-bold text-[#1E293B] mb-2">
              DUKSOO AI Online School
            </h1>
            <p className="text-sm text-[#64748B]">
              이용할 서비스를 선택하세요
            </p>
          </div>

          {/* 두 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-xl mx-auto">
            {/* 교무실 */}
            <Link
              href="/office/login"
              className="group relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
            >
              <div className="h-14 w-14 rounded-xl bg-[#1B2A4A] text-white flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <School className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold text-[#1E293B] mb-1">
                AI 온라인 교무실
              </h2>
              <p className="text-sm text-[#64748B] mb-4">
                수업·세특·상담·캘린더
              </p>
              <span className="inline-block rounded-full bg-[#1B2A4A] text-white text-sm px-5 py-2 group-hover:bg-[#3B82F6] transition-colors">
                교사 입장
              </span>
            </Link>

            {/* 교실 */}
            <Link
              href="/classroom/login"
              className="group relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
            >
              <div className="h-14 w-14 rounded-xl bg-[#3B82F6] text-white flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <GraduationCap className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-bold text-[#1E293B] mb-1">
                AI 온라인 교실
              </h2>
              <p className="text-sm text-[#64748B] mb-4">
                AI와 함께하는 학습 공간
              </p>
              <span className="inline-block rounded-full bg-[#3B82F6] text-white text-sm px-5 py-2 group-hover:bg-[#2563EB] transition-colors">
                학생·교사 입장
              </span>
            </Link>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="text-center py-6 text-[11px] text-[#94A3B8]">
        덕수고등학교 · 교직원 및 재학생 전용 서비스
      </footer>
    </div>
  )
}
