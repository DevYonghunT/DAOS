/**
 * 창의적 체험활동 + 개인세특 기재 영역 카탈로그
 *
 * 출처: 2026학년도 학교생활기록부 기재요령 (고등학교) p.208
 *   · 한글 1자 = 3 Byte, 엔터 = 1 Byte 기준
 *   · 3학년은 '자치활동'이 없어 '자율활동'만 존재
 *   · 봉사활동 실적은 '실적별 50자'로 프로그램 하나당 한도 적용 (연간 누적 아님)
 */

export type RecordCategoryKey =
  | 'autonomous_council' // 자율·자치활동 (1·2학년)
  | 'autonomous' // 자율활동 (3학년)
  | 'club' // 동아리활동
  | 'career' // 진로활동
  | 'volunteer' // 봉사활동실적 (실적별 50자)
  | 'individual_detail' // 개인별 세부능력 및 특기사항

export type AccumulationMode = 'yearly' | 'per_entry'

export type RecordCategory = {
  key: RecordCategoryKey
  label: string
  description: string
  /** 한글 자 기준 참고값 */
  limitChars: number
  /** NEIS 실제 제한 (byte) */
  limitBytes: number
  /** yearly = 학생별 학년도 누적 한도 / per_entry = 개별 실적당 한도 */
  mode: AccumulationMode
  /** 이 영역이 존재하는 학년 */
  grades: Array<1 | 2 | 3>
  /** UI 정렬 순서 */
  sortOrder: number
  /** 배지 색상 */
  color: 'blue' | 'cyan' | 'amber' | 'green' | 'red' | 'violet' | 'slate'
}

export const RECORD_CATEGORIES: RecordCategory[] = [
  {
    key: 'autonomous_council',
    label: '자율·자치활동',
    description: '1·2학년 창의적 체험활동 특기사항',
    limitChars: 500,
    limitBytes: 1500,
    mode: 'yearly',
    grades: [1, 2],
    sortOrder: 1,
    color: 'blue',
  },
  {
    key: 'autonomous',
    label: '자율활동',
    description: '3학년 창의적 체험활동 특기사항 (자치활동 제외)',
    limitChars: 500,
    limitBytes: 1500,
    mode: 'yearly',
    grades: [3],
    sortOrder: 1,
    color: 'blue',
  },
  {
    key: 'club',
    label: '동아리활동',
    description: '동아리활동 특기사항',
    limitChars: 500,
    limitBytes: 1500,
    mode: 'yearly',
    grades: [1, 2, 3],
    sortOrder: 2,
    color: 'cyan',
  },
  {
    key: 'career',
    label: '진로활동',
    description: '진로활동 특기사항',
    limitChars: 500,
    limitBytes: 1500,
    mode: 'yearly',
    grades: [1, 2, 3],
    sortOrder: 3,
    color: 'violet',
  },
  {
    key: 'volunteer',
    label: '봉사활동 실적',
    description: '봉사활동 실적별 활동내용 (실적별 50자)',
    limitChars: 50,
    limitBytes: 150,
    mode: 'per_entry',
    grades: [1, 2, 3],
    sortOrder: 4,
    color: 'green',
  },
  {
    key: 'individual_detail',
    label: '개인별 세부능력 및 특기사항',
    description: '개인별 세부능력 및 특기사항',
    limitChars: 500,
    limitBytes: 1500,
    mode: 'yearly',
    grades: [1, 2, 3],
    sortOrder: 5,
    color: 'amber',
  },
]

export function findCategory(
  key: string | null | undefined
): RecordCategory | undefined {
  if (!key) return undefined
  return RECORD_CATEGORIES.find((c) => c.key === key)
}

export function categoriesForGrade(grade: number | null): RecordCategory[] {
  if (grade == null) return RECORD_CATEGORIES
  return RECORD_CATEGORIES.filter((c) =>
    c.grades.includes(grade as 1 | 2 | 3)
  ).sort((a, b) => a.sortOrder - b.sortOrder)
}

export function allCategoriesSorted(): RecordCategory[] {
  return [...RECORD_CATEGORIES].sort((a, b) => a.sortOrder - b.sortOrder)
}

export const RECORD_CATEGORY_KEYS = RECORD_CATEGORIES.map((c) => c.key)
