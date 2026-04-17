'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Search, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

type Student = {
  id: string
  student_number: string
  name: string
  grade: number | null
  class_number: number | null
  number_in_class: number | null
}

export default function NewRoomPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [classNum, setClassNum] = useState('')
  const [description, setDescription] = useState('')
  const [personaPrompt, setPersonaPrompt] = useState('')
  const [aiModel, setAiModel] = useState('claude-haiku-4-5')
  const [invited, setInvited] = useState<Student[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 학생 검색
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Student[]>([])
  const [searching, setSearching] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/classroom/students/search?q=${encodeURIComponent(query)}&academic_year=${new Date().getFullYear()}`,
          { signal: ctrl.signal }
        )
        if (!res.ok) throw new Error()
        const json = await res.json()
        setResults(json.students ?? [])
      } catch { /* ignore */ }
      finally { setSearching(false) }
    }, 200)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [query])

  // 학년/반 일괄 초대
  const bulkInvite = async () => {
    const g = Number(grade)
    const c = Number(classNum)
    if (!g || !c) { setError('학년과 반을 입력하세요.'); return }
    setSearching(true)
    try {
      // 해당 학년 반 모든 학생 조회
      const res = await fetch(
        `/api/classroom/students/search?q=${g}&academic_year=${new Date().getFullYear()}`
      )
      if (!res.ok) throw new Error()
      const json = await res.json()
      const filtered = (json.students as Student[]).filter(
        (s) => s.grade === g && s.class_number === c
      )
      const existingIds = new Set(invited.map((i) => i.id))
      const newOnes = filtered.filter((s) => !existingIds.has(s.id))
      setInvited((prev) => [...prev, ...newOnes])
    } catch {
      setError('일괄 초대 실패')
    } finally {
      setSearching(false)
    }
  }

  const addStudent = (s: Student) => {
    if (invited.some((i) => i.id === s.id)) return
    setInvited((prev) => [...prev, s])
    setQuery('')
    setResults([])
  }

  const removeStudent = (id: string) => {
    setInvited((prev) => prev.filter((s) => s.id !== id))
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('제목은 필수입니다.'); return }
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/classroom/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          subject: subject.trim() || null,
          grade: grade ? Number(grade) : null,
          class_number: classNum ? Number(classNum) : null,
          persona_prompt: personaPrompt.trim() || null,
          ai_model: aiModel,
          student_ids: invited.map((s) => s.id),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || '방 생성 실패')
      }
      const json = await res.json()
      router.push(`/classroom/rooms/${json.room.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '방 생성 실패')
    } finally {
      setCreating(false)
    }
  }

  const invitedSet = new Set(invited.map((i) => i.id))
  const filtered = results.filter((s) => !invitedSet.has(s.id))

  return (
    <div className="flex-1 h-full overflow-hidden">
      <form onSubmit={handleCreate} className="h-full flex flex-col">
        {/* 헤더 */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#1E293B]">새 방 만들기</h1>
            <p className="text-xs text-[#64748B]">기본 정보와 학생을 설정하고 방을 만드세요.</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>취소</Button>
            <Button type="submit" disabled={creating} size="sm" className="bg-[#3B82F6] hover:bg-[#2563EB]">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              방 만들기
            </Button>
          </div>
        </div>

        {error && (
          <div className="px-6 py-2 bg-red-50 border-b border-red-200 shrink-0">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* 2컬럼 본문 */}
        <div className="flex-1 min-h-0 flex">
          {/* 좌측: 기본 정보 + AI 설정 */}
          <div className="w-1/2 border-r border-slate-200 overflow-y-auto p-5 space-y-4">
            {/* 기본 정보 */}
            <section className="space-y-3">
              <p className="text-[11px] uppercase tracking-wider text-[#94A3B8] font-semibold">기본 정보</p>
              <div className="space-y-1.5">
                <Label className="text-xs">제목 *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 3학년 2반 물리학 토론" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">교과</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="물리학" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">학년</Label>
                  <Input type="number" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="3" min={1} max={3} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">반</Label>
                  <Input type="number" value={classNum} onChange={(e) => setClassNum(e.target.value)} placeholder="2" min={1} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">설명 (선택, 100자)</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 100))}
                  placeholder="이 방의 목적이나 안내 사항"
                  maxLength={100}
                />
                {description.length > 0 && (
                  <p className="text-[10px] text-[#94A3B8] text-right">{description.length}/100</p>
                )}
              </div>
            </section>

            <div className="border-t border-slate-100 pt-4" />

            {/* AI 페르소나 */}
            <section className="space-y-3">
              <p className="text-[11px] uppercase tracking-wider text-[#06B6D4] font-semibold">AI 페르소나 (선택)</p>
              <div className="space-y-1">
                <Label className="text-xs">페르소나 프롬프트</Label>
                <Textarea
                  value={personaPrompt}
                  onChange={(e) => setPersonaPrompt(e.target.value)}
                  rows={3}
                  placeholder={`예: "너는 친절한 물리학 선생님이야. 쉬운 말로 설명해줘."`}
                  className="text-sm"
                  maxLength={2000}
                />
                <p className="text-[10px] text-[#64748B]">비워두면 기본 AI 조교 역할.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">AI 모델</Label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs"
                >
                  <option value="claude-haiku-4-5">Haiku 4.5 — 빠르고 경제적</option>
                  <option value="claude-sonnet-4-6">Sonnet 4.6 — 더 정교한 답변</option>
                </select>
              </div>
            </section>
          </div>

          {/* 우측: 학생 초대 (세로로 길게) */}
          <div className="w-1/2 flex flex-col overflow-hidden p-5">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <p className="text-[11px] uppercase tracking-wider text-[#94A3B8] font-semibold">
                학생 초대 ({invited.length}명)
              </p>
              <Button type="button" variant="outline" size="sm" onClick={bulkInvite} disabled={!grade || !classNum}>
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                {grade || '?'}-{classNum || '?'} 전체
              </Button>
            </div>

            {/* 검색 */}
            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="학번 또는 이름으로 검색"
                className="pl-8"
              />
              {query && (
                <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-lg border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                  {searching && <p className="p-2 text-xs text-[#64748B]">검색 중…</p>}
                  {!searching && filtered.length === 0 && <p className="p-2 text-xs text-[#64748B]">결과 없음</p>}
                  {filtered.map((s) => (
                    <button
                      key={s.id} type="button"
                      onClick={() => addStudent(s)}
                      className="w-full text-left px-3 py-2 hover:bg-[#F7F6F3] text-sm"
                    >
                      <span className="font-mono text-xs text-[#64748B]">{s.student_number}</span>{' '}
                      <span className="font-medium">{s.name}</span>
                      {s.grade != null && <span className="text-[11px] text-[#94A3B8] ml-1">({s.grade}-{s.class_number}-{s.number_in_class ?? '?'})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 초대 목록 — 남은 공간 스크롤 */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {invited.length > 0 ? (
                <ul className="space-y-1">
                  {invited.map((s, i) => (
                    <li key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5 bg-white">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-[#94A3B8] w-5 text-right">{i + 1}</span>
                        <span className="text-xs font-mono text-[#64748B]">{s.student_number}</span>
                        <span className="text-sm text-[#1E293B] truncate">{s.name}</span>
                        {s.grade != null && (
                          <span className="text-[10px] text-[#94A3B8]">{s.grade}-{s.class_number}-{s.number_in_class ?? '?'}</span>
                        )}
                      </div>
                      <button type="button" onClick={() => removeStudent(s.id)} className="text-[#94A3B8] hover:text-red-500 p-1">
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-[#94A3B8] text-center">
                    학생을 검색해 추가하거나<br />학년/반 전체 초대를 사용하세요.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
