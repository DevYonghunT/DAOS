import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'
import { DraftUpsertSchema } from '@/lib/setuk/schema'
import { findCategory } from '@/lib/activity/categories'
import { countNeisBytes } from '@/lib/activity/neis-bytes'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** GET /api/setuk/drafts/:id */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { data, error } = await supabase
    .from('setuk_drafts')
    .select('*')
    .eq('id', id)
    .eq('teacher_id', teacher.id)
    .maybeSingle()
  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ draft: data })
}

/** PATCH /api/setuk/drafts/:id */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const parsed = DraftUpsertSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const input = parsed.data
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  for (const [key, value] of Object.entries(input)) {
    if (key === 'byte_limit' || key === 'byte_used') continue
    if (value !== undefined) update[key] = value
  }

  if (input.subject) {
    const cat = findCategory(input.subject)
    if (cat) update.byte_limit = cat.limitBytes
  }

  // byte_used는 final_text | draft 기반 자동 계산
  if (input.final_text !== undefined || input.draft !== undefined) {
    const text =
      (input.final_text?.trim() || input.draft?.trim()) ?? ''
    update.byte_used = countNeisBytes(text)
  }

  const { data, error } = await supabase
    .from('setuk_drafts')
    .update(update)
    .eq('id', id)
    .eq('teacher_id', teacher.id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'update_failed', message: error?.message },
      { status: 500 }
    )
  }
  return NextResponse.json({ draft: data })
}

/** DELETE /api/setuk/drafts/:id */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { error } = await supabase
    .from('setuk_drafts')
    .delete()
    .eq('id', id)
    .eq('teacher_id', teacher.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
