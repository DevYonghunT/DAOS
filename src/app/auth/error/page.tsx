import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ALLOWED_EMAIL_HINT } from '@/lib/auth/allowed-email'

const REASONS: Record<string, { title: string; message: string }> = {
  forbidden_email: {
    title: '접근이 허용되지 않은 계정입니다',
    message: ALLOWED_EMAIL_HINT,
  },
  oauth_failed: {
    title: '로그인에 실패했습니다',
    message: '잠시 후 다시 시도해 주세요.',
  },
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  const info = REASONS[reason ?? ''] ?? {
    title: '오류가 발생했습니다',
    message: '알 수 없는 인증 오류입니다.',
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3] px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <h1 className="text-xl font-bold text-[#1E293B] mb-3">{info.title}</h1>
        <p className="text-sm text-[#64748B] mb-8 leading-relaxed">{info.message}</p>
        <Link href="/office/login">
          <Button className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-lg py-3 text-base">
            로그인 화면으로
          </Button>
        </Link>
      </div>
    </div>
  )
}
