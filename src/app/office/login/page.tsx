'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ALLOWED_DOMAIN } from '@/lib/auth/allowed-email'

const ERROR_MESSAGES: Record<string, string> = {
  forbidden_email: 't로 시작하는 덕수고 교직원 계정만 이용할 수 있습니다.',
  oauth_failed: '로그인 처리 중 문제가 발생했습니다. 다시 시도해 주세요.',
  unknown: '알 수 없는 오류가 발생했습니다.',
}

function LoginContent() {
  const supabase = createClient()
  const params = useSearchParams()
  const reason = params.get('reason')
  const [loading, setLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/office`,
        queryParams: {
          hd: ALLOWED_DOMAIN,
          prompt: 'select_account',
        },
      },
    })
    if (error) {
      setLoading(false)
    }
  }

  const serverError = reason
    ? ERROR_MESSAGES[reason] ?? ERROR_MESSAGES.unknown
    : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3] px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <Image
          src="/duksoo-logo.png"
          alt="덕수고등학교 교표"
          width={256}
          height={256}
          priority
          unoptimized
          className="h-16 w-16 mx-auto mb-4 object-contain"
        />
        <h1 className="text-xl font-bold text-[#1E293B] mb-1">
          AI 온라인 교무실
        </h1>
        <p className="text-sm text-[#64748B] mb-8">덕수고등학교</p>

        {serverError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <Button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white py-3 text-base"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Google 계정으로 로그인
        </Button>

        <p className="text-xs text-[#64748B] mt-6 leading-relaxed">
          교직원 전용 서비스입니다.
          <br />
          t로 시작하는 덕수고 교직원 계정(@duksoo.hs.kr)만 이용할 수 있습니다.
        </p>

        <Link
          href="/"
          className="inline-block mt-4 text-xs text-[#3B82F6] hover:underline"
        >
          ← 메인으로 돌아가기
        </Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
