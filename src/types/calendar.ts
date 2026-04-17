export type EventType = 'personal' | 'shared' | 'school'

export type EventColor =
  | 'blue'
  | 'cyan'
  | 'amber'
  | 'green'
  | 'red'
  | 'violet'
  | 'slate'

export type EventRecord = {
  id: string
  title: string
  description: string | null
  start_date: string // ISO
  end_date: string | null
  all_day: boolean
  color: string
  event_type: EventType
  created_by: string
  created_at: string
  updated_at: string
}

export type EventShareRecord = {
  id: string
  event_id: string
  shared_with: string
  is_read: boolean
  created_at: string
}

export type TeacherLite = {
  id: string
  name: string
  email: string
  department: string | null
  subject: string | null
}

export type EventWithShares = EventRecord & {
  shares?: Array<{
    teacher_id: string
    name: string
    is_read: boolean
  }>
}

export type AssigneeMatch = {
  query: string
  matches: TeacherLite[]
}
