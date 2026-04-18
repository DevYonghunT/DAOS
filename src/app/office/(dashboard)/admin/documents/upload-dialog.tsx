'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  CheckCircle2,
  Loader2,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { value: 'regulation', label: '규정' },
  { value: 'plan', label: '계획서' },
  { value: 'assignment', label: '업무분장' },
  { value: 'calendar', label: '학사일정' },
  { value: 'other', label: '기타' },
] as const

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  existingDocument?: { id: string; title: string; category: string } | null
  onUploaded: (result: UploadResult) => void
}

export type UploadResult = {
  document_id: string
  version_id: string
  version: number
  page_count: number
  chunk_count: number
  total_tokens: number
  ai_conversion?: Record<string, unknown>
}

type ProgressState = {
  step: string
  percent: number
  message: string
  detail?: string
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  existingDocument,
  onUploaded,
}: Props) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string>('regulation')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [convertWithAi, setConvertWithAi] = useState(true)
  const [aiModel, setAiModel] = useState<string>('claude-haiku-4-5')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setProgress(null)
    setDone(false)
    setFile(null)
    setUploading(false)
    if (existingDocument) {
      setTitle(existingDocument.title)
      setCategory(existingDocument.category)
    } else {
      setTitle('')
      setCategory('regulation')
    }
    setEffectiveDate('')
    setConvertWithAi(true)
    setAiModel('claude-haiku-4-5')
    if (fileRef.current) fileRef.current.value = ''
  }, [open, existingDocument])

  const isPdf = !!file && /\.pdf$/i.test(file.name)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) return setError('파일을 선택하세요.')
    if (!title.trim()) return setError('제목을 입력하세요.')

    setUploading(true)
    setError(null)
    setProgress({ step: 'uploading', percent: 0, message: '서버로 전송 중...' })
    setDone(false)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('title', title.trim())
      fd.append('category', category)
      if (effectiveDate) fd.append('effective_date', effectiveDate)
      if (existingDocument) fd.append('document_id', existingDocument.id)
      if (isPdf && convertWithAi) {
        fd.append('convert_with_ai', 'true')
        fd.append('ai_model', aiModel)
      }

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: fd,
        signal: ctrl.signal,
      })

      if (!res.ok) {
        const text = await res.text()
        try {
          const j = JSON.parse(text)
          throw new Error(j.message || j.error || `HTTP ${res.status}`)
        } catch (jsonErr) {
          if (jsonErr instanceof SyntaxError) throw new Error(text || `HTTP ${res.status}`)
          throw jsonErr
        }
      }

      // SSE 스트림 파싱
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          let currentEvent = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              const data = line.slice(6)
              try {
                const parsed = JSON.parse(data)
                if (currentEvent === 'progress') {
                  setProgress(parsed as ProgressState)
                } else if (currentEvent === 'done') {
                  setDone(true)
                  setProgress({
                    step: 'done',
                    percent: 100,
                    message: `완료! ${parsed.chunk_count}개 청크로 저장됨`,
                  })
                  setTimeout(() => {
                    onUploaded(parsed as UploadResult)
                    onOpenChange(false)
                  }, 1200)
                } else if (currentEvent === 'error') {
                  throw new Error(parsed.message || '업로드 실패')
                }
              } catch (parseErr) {
                if (parseErr instanceof SyntaxError) continue
                throw parseErr
              }
              currentEvent = ''
            }
          }
        }
      } else {
        // SSE가 아닌 JSON 응답 (fallback — 비AI 경로)
        const result = (await res.json()) as UploadResult
        setDone(true)
        setProgress({ step: 'done', percent: 100, message: '업로드 완료!' })
        setTimeout(() => {
          onUploaded(result)
          onOpenChange(false)
        }, 800)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setProgress(null)
      } else {
        setError(err instanceof Error ? err.message : '업로드 실패')
        setProgress(null)
      }
    } finally {
      setUploading(false)
      abortRef.current = null
    }
  }

  const handleCancel = () => {
    if (uploading) {
      abortRef.current?.abort()
      setUploading(false)
      setProgress(null)
    } else {
      onOpenChange(false)
    }
  }

  const showForm = !uploading && !done

  return (
    <Dialog open={open} onOpenChange={uploading ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle>
            {existingDocument ? '새 버전 업로드' : '새 문서 업로드'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            PDF·DOCX·MD·TXT 지원. PDF는 AI가 Markdown으로 변환해 구조를 보존합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {showForm && (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>제목</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 2026 학교생활규정"
                  disabled={!!existingDocument}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>분류</Label>
                  <Select
                    value={category}
                    onValueChange={setCategory}
                    disabled={!!existingDocument}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>시행일 (선택)</Label>
                  <Input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>파일</Label>
                <Input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.md,.markdown,.txt"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file && (
                  <p className="text-[11px] text-[#64748B]">
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {isPdf && (
                <div className="rounded-lg border border-[#EEF4FF] bg-[#EEF4FF]/40 p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="ai-convert"
                      checked={convertWithAi}
                      onCheckedChange={(v) => setConvertWithAi(v === true)}
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="ai-convert"
                        className="text-sm inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-[#3B82F6]" />
                        AI로 Markdown 변환 (권장)
                      </Label>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        100페이지 초과 시 자동 분할 처리. 대용량 문서는 1~3분 소요됩니다.
                      </p>
                    </div>
                  </div>
                  {convertWithAi && (
                    <div className="pl-6 space-y-1.5">
                      <Label className="text-xs">변환 모델</Label>
                      <Select value={aiModel} onValueChange={setAiModel}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="claude-haiku-4-5">
                            Haiku 4.5 — 빠르고 저렴 (권장)
                          </SelectItem>
                          <SelectItem value="claude-sonnet-4-6">
                            Sonnet 4.6 — 복잡 문서용
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {existingDocument && (
                <p className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2">
                  새 버전 업로드 시 기존 버전은 자동 비활성 처리됩니다.
                </p>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  className="bg-[#3B82F6] hover:bg-[#2563EB]"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  업로드
                </Button>
              </div>
            </form>
          )}

          {/* ── 진행률 표시 ─────────────────────────────── */}
          {(uploading || done) && progress && (
            <div className="space-y-4 py-2">
              {/* 아이콘 + 메시지 */}
              <div className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                ) : (
                  <div className="relative h-6 w-6 shrink-0">
                    <Loader2 className="h-6 w-6 text-[#3B82F6] animate-spin" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      done ? 'text-emerald-700' : 'text-[#1E293B]'
                    )}
                  >
                    {progress.message}
                  </p>
                  {progress.detail && (
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {progress.detail}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    done ? 'text-emerald-600' : 'text-[#3B82F6]'
                  )}
                >
                  {progress.percent}%
                </span>
              </div>

              {/* 프로그래스바 */}
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    done ? 'bg-emerald-500' : 'bg-[#3B82F6]'
                  )}
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              {/* 단계 표시 */}
              <div className="flex items-center gap-4 text-[11px] text-[#94A3B8] justify-center">
                <StepDot
                  active={progress.step === 'uploading' || progress.step === 'extracting' || progress.step === 'splitting'}
                  done={
                    ['converting', 'chunking', 'saving', 'storing', 'done'].includes(
                      progress.step
                    )
                  }
                  label="추출"
                />
                <StepLine
                  done={
                    ['converting', 'chunking', 'saving', 'storing', 'done'].includes(
                      progress.step
                    )
                  }
                />
                <StepDot
                  active={progress.step === 'converting'}
                  done={['chunking', 'saving', 'storing', 'done'].includes(
                    progress.step
                  )}
                  label="AI 변환"
                />
                <StepLine
                  done={['chunking', 'saving', 'storing', 'done'].includes(
                    progress.step
                  )}
                />
                <StepDot
                  active={
                    progress.step === 'chunking' ||
                    progress.step === 'saving' ||
                    progress.step === 'storing'
                  }
                  done={progress.step === 'done'}
                  label="저장"
                />
                <StepLine done={progress.step === 'done'} />
                <StepDot
                  active={progress.step === 'done'}
                  done={progress.step === 'done'}
                  label="완료"
                />
              </div>

              {/* 취소 버튼 (진행 중일 때만) */}
              {uploading && !done && (
                <div className="flex justify-center pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                  >
                    업로드 취소
                  </Button>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean
  done: boolean
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          'h-3 w-3 rounded-full border-2 transition-all',
          done
            ? 'bg-emerald-500 border-emerald-500'
            : active
              ? 'bg-[#3B82F6] border-[#3B82F6] animate-pulse'
              : 'bg-white border-slate-300'
        )}
      />
      <span
        className={cn(
          'text-[10px]',
          done ? 'text-emerald-600' : active ? 'text-[#1E293B]' : 'text-[#94A3B8]'
        )}
      >
        {label}
      </span>
    </div>
  )
}

function StepLine({ done }: { done: boolean }) {
  return (
    <div
      className={cn(
        'flex-1 h-0.5 min-w-[20px] rounded-full transition-all',
        done ? 'bg-emerald-400' : 'bg-slate-200'
      )}
    />
  )
}
