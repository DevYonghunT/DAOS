export type ProgramStatus = 'planned' | 'completed'

export type ProgramRecord = {
  id: string
  academic_year: number
  department: string
  program_date: string // yyyy-MM-dd
  program_name: string
  setuk_template: string | null
  record_category: string | null
  target_grade: string | null
  byte_limit: number
  teacher_id: string | null
  status: ProgramStatus
  created_at: string
  updated_at: string
}

export type ProgramWithMeta = ProgramRecord & {
  participant_count?: number
  teacher_name?: string | null
}

export type StudentSearchResult = {
  id: string // student_profiles.id
  student_number: string
  name: string
  grade: number | null
  class_number: number | null
  number_in_class: number | null
  academic_year: number | null
}

export type ParticipantRecord = {
  id: string
  program_id: string
  student_id: string
  participant_order: number | null
  checked_in: boolean
  checked_in_at: string | null
  created_at: string
  student?: StudentSearchResult
}

export type ParticipationSummaryRow = {
  student_id: string
  name: string
  student_number: string
  academic_year: number
  grade: number
  class_number: number
  number_in_class: number | null
  total_participations: number
  departments: string[] | null
  participated_programs:
    | Array<{
        program_name: string
        program_date: string
        department: string
        setuk_template: string | null
        record_category: string | null
      }>
    | null
  participation_percentile: number
}
