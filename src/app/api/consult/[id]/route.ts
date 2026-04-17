import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTeacherWithRole } from '@/lib/auth/teacher'
import { ConsultUpsertSchema } from '@/lib/consult/schema'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** PATCH /api/consult/:id */
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

  const parsed = ConsultUpsertSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) update[key] = value
  }

  const { data, error } = await supabase
    .from('consultations')
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
  return NextResponse.json({ consultation: data })
}

/** DELETE /api/consult/:id */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const teacher = await getTeacherWithRole(supabase)
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('consultations')
    .delete()
    .eq('id', id)
    .eq('teacher_id', teacher.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
