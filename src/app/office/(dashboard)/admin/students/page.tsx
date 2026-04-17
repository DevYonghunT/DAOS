'use client'

import { useState } from 'react'
import { Loader2, Upload, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

type ImportResult = {
  total_rows: number
  created: number
  updated: number
  enrolled: number
  errors: string[]
}

const SAMPLE_CSV = `학번,이름,성별,입학년도,학년,반,번호
20260001,김덕수,M,2026,1,2,1
20260002,이영희,F,2026,1,2,2
20260003,박철수,M,2026,1,3,15`

export default function AdminStudentsPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [csv, setCsv] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImport = async () => {
    if (!csv.trim()) return setError('CSV 데이터를 입력하세요.')
    setImporting(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, academic_year: year }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message || j.error || 'import 실패')
      }
      setResult(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'import 실패')
    } finally {
      setImporting(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsv(text)
  }

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-[#1E293B]">학생 일괄 등록</h1>
          <p className="text-sm text-[#64748B] mt-1">
            CSV 파일로 학생을 일괄 등록합니다. 학번이 같은 학생은 정보만 업데이트됩니다.
          </p>
        </header>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>학년도</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={2020} max={2100}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CSV 파일 업로드 (선택)</Label>
              <Input type="file" accept=".csv,.txt" onChange={handleFileUpload} />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>CSV 데이터</Label>
              <button
                type="button"
                onClick={() => setCsv(SAMPLE_CSV)}
                className="text-[11px] text-[#3B82F6] hover:underline"
              >
                샘플 데이터 넣기
              </button>
            </div>
            <Textarea
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              rows={10}
              placeholder={SAMPLE_CSV}
              className="font-mono text-xs bg-[#F7F6F3] border-transparent"
            />
            <p className="text-[11px] text-[#64748B]">
              형식: 학번,이름,성별,입학년도,학년,반,번호 (첫 줄은 헤더)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleImport}
              disabled={importing || !csv.trim()}
              className="bg-[#3B82F6] hover:bg-[#2563EB]"
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              일괄 등록
            </Button>
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {result && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                등록 완료
              </div>
              <div className="grid grid-cols-4 gap-3 text-center">
                <StatBox label="전체 행" value={result.total_rows} />
                <StatBox label="신규 생성" value={result.created} />
                <StatBox label="기존 업데이트" value={result.updated} />
                <StatBox label="소속 등록" value={result.enrolled} />
              </div>
              {result.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-700 space-y-0.5">
                  <p className="font-medium">오류 ({result.errors.length}건):</p>
                  {result.errors.map((e, i) => (
                    <p key={i}>· {e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white border border-emerald-200 px-3 py-2">
      <p className="text-[11px] text-[#64748B]">{label}</p>
      <p className="text-lg font-bold text-[#1E293B]">{value}</p>
    </div>
  )
}
