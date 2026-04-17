import type { SupabaseClient } from '@supabase/supabase-js'
import type { AssigneeMatch, TeacherLite } from '@/types/calendar'

/**
 * AI가 추출한 assignee_names를 teachers 테이블과 매칭
 *
 * 전략:
 * 1. 공백 제거 + ilike '%이름%' 로 부분 일치
 * 2. 동명이인 시 부서/과목 포함해서 사용자가 고를 수 있게 모두 반환
 * 3. 본인은 매칭 결과에서 제외 (자기 일정에 자기를 공유하지 않음)
 */
export async function matchAssignees(
  supabase: SupabaseClient,
  names: string[],
  selfTeacherId: string
): Promise<AssigneeMatch[]> {
  const cleaned = Array.from(
    new Set(
      names
        .map((n) => n.trim().replace(/\s+/g, ''))
        .filter((n) => n.length >= 2)
    )
  )
  if (cleaned.length === 0) return []

  const results: AssigneeMatch[] = []

  for (const query of cleaned) {
    const { data, error } = await supabase
      .from('teachers')
      .select('id, name, email, department, subject')
      .ilike('name', `%${query}%`)
      .eq('is_active', true)
      .neq('id', selfTeacherId)
      .limit(10)

    if (error) {
      console.error('[calendar/assignee] 검색 오류', error)
      results.push({ query, matches: [] })
      continue
    }

    results.push({ query, matches: (data ?? []) as TeacherLite[] })
  }

  return results
}

/**
 * 단일 명확 매치(match가 정확히 1개)만 뽑아 teacher id 배열 반환
 * 복수 매치나 매치 없음은 사용자 확인 필요 → 여기서 제외됨
 */
export function autoPickUnambiguous(matches: AssigneeMatch[]): string[] {
  return matches
    .filter((m) => m.matches.length === 1)
    .map((m) => m.matches[0].id)
}
