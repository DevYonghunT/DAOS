import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAIStructured } from '@/lib/ai/structured'
import { calendarParsePrompt } from '@/lib/ai/prompts/calendar'
import { CalendarEventSchema } from '@/lib/calendar/schema'
import { matchAssignees } from '@/lib/calendar/assignee'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!teacher) {
    return NextResponse.json({ error: 'teacher_not_found' }, { status: 403 })
  }

  let payload: { input?: string }
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const input = (payload.input ?? '').trim()
  if (!input) {
    return NextResponse.json({ error: 'empty_input' }, { status: 400 })
  }

  try {
    const parsed = await callAIStructured({
      model: 'claude-haiku-4-5',
      system: calendarParsePrompt(new Date()),
      messages: [{ role: 'user', content: input }],
      feature: 'calendar',
      teacherId: teacher.id,
      enableCache: true,
      schema: CalendarEventSchema,
      schemaName: 'CalendarEvent',
      schemaDescription: '자연어에서 추출한 일정 정보',
    })

    const assigneeMatches = await matchAssignees(
      supabase,
      parsed.assignee_names,
      teacher.id
    )

    return NextResponse.json({
      parsed,
      assignee_matches: assigneeMatches,
    })
  } catch (err) {
    console.error('[api/calendar/parse] 실패', err)
    return NextResponse.json(
      {
        error: 'parse_failed',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
