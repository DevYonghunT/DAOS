import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/context'
import { verifyRoomMember } from '@/lib/classroom/access'
import { format } from 'date-fns'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

/** GET /api/classroom/rooms/:id/export — MD 파일 다운로드 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const ctx = await getCurrentUserContext(supabase)
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await verifyRoomMember(supabase, id, ctx))) {
    return NextResponse.json({ error: 'not_a_member' }, { status: 403 })
  }

  // 방 정보
  const { data: room } = await supabase
    .from('rooms')
    .select('title, subject, grade, class_number, persona_prompt, created_by, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!room) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: creator } = await supabase
    .from('teachers')
    .select('name')
    .eq('id', room.created_by)
    .maybeSingle()

  const { count: memberCount } = await supabase
    .from('room_members')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', id)
    .eq('is_active', true)
    .eq('member_type', 'student')

  const { data: attachments } = await supabase
    .from('room_attachments')
    .select('filename')
    .eq('room_id', id)

  // 전체 메시지
  const { data: msgs } = await supabase
    .from('room_messages')
    .select('sender_type, teacher_id, student_id, content, created_at')
    .eq('room_id', id)
    .order('created_at', { ascending: true })
    .limit(5000)

  // 이름 매핑
  const tIds = new Set<string>()
  const sIds = new Set<string>()
  for (const m of msgs ?? []) {
    if (m.teacher_id) tIds.add(m.teacher_id)
    if (m.student_id) sIds.add(m.student_id)
  }
  const nameMap = new Map<string, string>()
  if (tIds.size > 0) {
    const { data } = await supabase.from('teachers').select('id, name').in('id', [...tIds])
    for (const t of data ?? []) nameMap.set(t.id, t.name)
  }
  if (sIds.size > 0) {
    const { data } = await supabase.from('student_profiles').select('id, name').in('id', [...sIds])
    for (const s of data ?? []) nameMap.set(s.id, s.name)
  }

  // MD 생성
  const lines: string[] = []
  lines.push(`# ${room.title}\n`)
  lines.push('**기본 정보**')
  if (room.grade) lines.push(`- 학년/반: ${room.grade}학년 ${room.class_number ?? ''}반`)
  if (room.subject) lines.push(`- 주제: ${room.subject}`)
  lines.push(`- 생성일: ${format(new Date(room.created_at), 'yyyy-MM-dd')}`)
  lines.push(`- 교사: ${creator?.name ?? '알 수 없음'}`)
  lines.push(`- 학생 수: ${memberCount ?? 0}명`)
  lines.push(`- 내보낸 시각: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`)

  if ((attachments ?? []).length > 0) {
    lines.push('\n**참고 자료**')
    for (const a of attachments ?? []) {
      lines.push(`- ${a.filename}`)
    }
  }

  if (room.persona_prompt) {
    lines.push('\n**AI 페르소나**')
    lines.push(`> ${room.persona_prompt.replace(/\n/g, '\n> ')}`)
  }

  lines.push('\n---\n')
  lines.push('## 대화 기록\n')

  let currentDate = ''
  for (const m of msgs ?? []) {
    const dt = format(new Date(m.created_at), 'yyyy-MM-dd')
    if (dt !== currentDate) {
      currentDate = dt
      lines.push(`### ${dt}\n`)
    }

    const time = format(new Date(m.created_at), 'HH:mm')
    if (m.sender_type === 'system') {
      lines.push(`*[${time}] ${m.content}*\n`)
    } else {
      const icon = m.sender_type === 'ai' ? '🤖' : m.sender_type === 'teacher' ? '👨‍🏫' : '👤'
      const name = m.sender_type === 'ai'
        ? 'AI'
        : nameMap.get(m.teacher_id ?? m.student_id ?? '') ?? '알 수 없음'
      const role = m.sender_type === 'teacher' ? '교사' : m.sender_type === 'student' ? '학생' : 'AI'
      lines.push(`**[${time}] ${icon} ${name} (${role})**`)
      lines.push(`${m.content}\n`)
    }
  }

  const md = lines.join('\n')
  const safeTitle = room.title.replace(/[\/\\?%*:|"<>]/g, '_')
  const filename = `${safeTitle}_${format(new Date(), 'yyyy-MM-dd')}.md`

  return new Response(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
