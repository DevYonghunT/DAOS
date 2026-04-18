import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAllowedEmail } from '@/lib/auth/allowed-email'
import { guessUserType } from '@/lib/auth/context'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

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

  // Google SSO 교사: 반드시 t*@duksoo.hs.kr 이메일만 허용
  // deoksu.local은 내부 ID 기반이라 여기선 Google SSO만 검증
  if (!email?.endsWith('@deoksu.local') && !isAllowedEmail(email)) {
    // 허용되지 않은 외부 이메일 → 즉시 로그아웃 + 에러
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/auth/error?reason=forbidden_email`)
  }

  const destination =
    next || (userType === 'student' ? '/classroom' : '/office')

  return NextResponse.redirect(`${origin}${destination}`)
}
