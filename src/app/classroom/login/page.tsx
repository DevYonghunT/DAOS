'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { GraduationCap, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ClassroomLoginPage() {
  const supabase = createClient()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleIdLogin = async (e: FormEvent) => {
    e.preventDefault()
    const id = loginId.trim().toLowerCase()
    if (!id || !password) {
      setError('아이디와 비밀번호를 입력하세요.')
      return
    }
    if (!id.startsWith('s') && !id.startsWith('t')) {
      setError('아이디는 s(학생) 또는 t(교사)로 시작해야 합니다.')
      return
    }
    setLoading(true)
    setError(null)
    const email = `${id}@deoksu.local`
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (authErr) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }
    window.location.href = '/classroom'
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/classroom`,
        queryParams: { prompt: 'select_account' },
      },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3] px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-[#3B82F6] text-white flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-[#1E293B] mb-1">
            AI 온라인 교실
          </h1>
          <p className="text-sm text-[#64748B]">덕수고등학교</p>
        </div>

        <form onSubmit={handleIdLogin} className="space-y-4 mb-6">
          <div className="space-y-1.5">
            <Label>아이디</Label>
            <Input
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="s20260001 또는 t12345"
              autoComplete="username"
            />
          </div>
          <div className="space-y-1.5">
            <Label>비밀번호</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#3B82F6] hover:bg-[#2563EB] py-3"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            로그인
          </Button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-[#94A3B8]">또는</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3"
        >
          Google 계정으로 로그인 (교사)
        </Button>

        <div className="mt-6 text-center space-y-2">
          <p className="text-[11px] text-[#64748B] leading-relaxed">
            학생: 학번(s20260001) · 교사: 교직원 ID(t로 시작)
          </p>
          <Link
            href="/"
            className="inline-block text-xs text-[#3B82F6] hover:underline"
          >
            ← 메인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
