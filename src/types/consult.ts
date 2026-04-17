export type ConsultationRecord = {
  id: string
  student_id: string
  teacher_id: string
  academic_year: number
  consultation_date: string
  attendees: string | null
  raw_input: string | null
  structured_summary: ConsultationSummary | null
  follow_up_date: string | null
  is_completed: boolean
  created_at: string
  updated_at: string
}

export type ConsultationSummary = {
  date: string
  attendees: string
  agenda: string[]
  details: string
  agreements: string[]
  follow_up: string
  follow_up_date: string | null
}

export type ConsultWithStudent = ConsultationRecord & {
  student_name?: string
  student_number?: string
  grade?: number | null
  class_number?: number | null
  number_in_class?: number | null
}
