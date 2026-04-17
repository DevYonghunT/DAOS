import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { guessUserType } from '@/lib/auth/context'

/**
 * 미들웨어 라우팅:
 *
 * / (랜딩)      → 로그인됐으면 유형별 홈, 아니면 랜딩 표시
 * /office/*     → 비로그인→/office/login, 학생→/classroom 차단
 * /classroom/*  → 비로그인→/classroom/login
 * 로그인 페이지  → 이미 로그인→해당 홈
 */

const PUBLIC_PATHS = [
  '/office/login',
  '/classroom/login',
  '/classroom/change-password',
  '/auth/callback',
  '/auth/error',
  '/auth/signout',
]

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 정적/API → 통과
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico' ||
    /\.(png|jpg|svg|css|js|ico|woff2?)$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoggedIn = !!user
  const userType = isLoggedIn ? guessUserType(user.email) : 'unknown'
  const homeForUser = userType === 'student' ? '/classroom' : '/office'

  // ── 랜딩 (/) ──
  if (pathname === '/') {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(homeForUser, request.url))
    }
    return supabaseResponse
  }

  // ── 공개 경로 ──
  if (isPublic(pathname)) {
    if (
      isLoggedIn &&
      (pathname === '/office/login' || pathname === '/classroom/login')
    ) {
      return NextResponse.redirect(new URL(homeForUser, request.url))
    }
    return supabaseResponse
  }

  // ── 비로그인 ──
  if (!isLoggedIn) {
    if (pathname.startsWith('/office')) {
      return NextResponse.redirect(new URL('/office/login', request.url))
    }
    if (pathname.startsWith('/classroom')) {
      return NextResponse.redirect(new URL('/classroom/login', request.url))
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  // ── 학생이 교무실 접근 → 차단 ──
  if (userType === 'student' && pathname.startsWith('/office')) {
    return NextResponse.redirect(new URL('/classroom', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
