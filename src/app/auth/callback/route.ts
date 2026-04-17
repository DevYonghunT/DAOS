import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { guessUserType } from '@/lib/auth/context'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') // /office 또는 /classroom

  if (!code) {
    return NextResponse.redirect(`${origin}/office/login?reason=oauth_failed`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/office/login?reason=oauth_failed`)
  }

  const email = data.user?.email
  const userType = guessUserType(email)

  // Google SSO 교사: 기존 이메일 허용 체크 (t*@duksoo.hs.kr)
  // deoksu.local은 내부 ID 기반이라 여기선 Google SSO만 해당
  if (
    userType === 'teacher' &&
    email &&
    !email.endsWith('@deoksu.local')
  ) {
    // Google SSO 사용자는 teachers 테이블에 handle_new_user()로 자동 생성됨
    // 별도 검증 필요 시 여기에 추가
  }

  // 리다이렉트 결정
  const destination =
    next ||
    (userType === 'student' ? '/classroom' : '/office')

  return NextResponse.redirect(`${origin}${destination}`)
}
