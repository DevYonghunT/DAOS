'use client'

import { useState, type FormEvent } from 'react'
import { Loader2, KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ChangePasswordPage() {
  const supabase = createClient()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    setLoading(true)
    setError(null)

    // 1. Supabase Auth 비밀번호 변경
    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPassword,
    })
    if (updateErr) {
      setError(updateErr.message)
      setLoading(false)
      return
    }

    // 2. student_profiles.password_changed = true
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('student_profiles')
        .update({ password_changed: true })
        .eq('auth_user_id', user.id)
    }

    window.location.href = '/classroom'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3] px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-amber-500 text-white flex items-center justify-center mx-auto mb-3">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold text-[#1E293B] mb-1">
            비밀번호 변경
          </h1>
          <p className="text-sm text-[#64748B]">
            첫 로그인 시 반드시 비밀번호를 변경해야 합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>새 비밀번호 (6자 이상)</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="새 비밀번호"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label>비밀번호 확인</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호 확인"
              autoComplete="new-password"
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
            className="w-full bg-amber-500 hover:bg-amber-600 py-3"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            비밀번호 변경
          </Button>
        </form>
      </div>
    </div>
  )
}
