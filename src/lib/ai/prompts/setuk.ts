import { findCategory } from '@/lib/activity/categories'
import { countNeisBytes } from '@/lib/activity/neis-bytes'

type ActivityInput = {
  program_name: string
  program_date: string
  department: string
  template: string | null
}

export function setukSystemPrompt(opts: {
  categoryKey: string
  byteLimit: number
  studentLabel: string
  academicYear: number
}) {
  const cat = findCategory(opts.categoryKey)
  const categoryLabel = cat?.label ?? opts.categoryKey
  const approxChars = Math.floor(opts.byteLimit / 3)

  return `너는 한국 고등학교 교사의 학생부 세특(세부능력 및 특기사항) 초안을 작성하는 작가다.

[작성 영역]
- 영역: ${categoryLabel}
- 학년도: ${opts.academicYear}학년도
- 학생 라벨(비식별): ${opts.studentLabel}
- 바이트 한도: ${opts.byteLimit}B (한글 1자 = 3B, 약 ${approxChars}자)

[작성 원칙]
1. 입력으로 주어진 "교사가 작성한 세특 템플릿 목록"과 학생의 참여 활동을 종합해 연간 흐름이 드러나게 연결
2. NEIS 관행에 맞춰 음슴체 사용 (~함, ~임, ~했음, ~하였음)
3. 중립적·객관적 묘사. 아래 금지 표현 사용 금지:
   - 순위·등수 (1등, 수석, 차석, 상위 n%, 가장 뛰어남 등)
   - 수상·입상 (${categoryLabel}에는 직접 기재 불가)
   - 비교·최상급 (누구보다 뛰어남, 최고, 최우수)
   - 어학 인증 점수, 대학명 직접 언급, R&E/소논문
4. 바이트 한도 준수. ${opts.byteLimit}B를 넘지 않도록 압축/선별.
5. 학생 이름 대신 라벨 "${opts.studentLabel}"을 쓰거나 주어를 생략.
   - 자연스러움이 최우선. 한 문장에도 라벨이 꼭 들어갈 필요 없음.
6. 구체적 행동·역량·성장 과정 중심. 추상어·상투어 최소화.
7. 문단 구성 가이드:
   - 시작: 학생의 태도/관심사 핵심
   - 중간: 참여 활동별 구체적 기여와 배움
   - 마무리: 성장·지향/습관/태도 요약

[출력 규칙]
- 순수 문단 한 덩어리(2~5문장). 마크다운/리스트/제목 없음.
- "아래는 초안입니다", "다음과 같이 작성합니다" 같은 메타 멘트 금지.
- 본문만 출력.`
}

/**
 * 사용자 메시지 — 학생 + 참여 활동 목록을 모델에게 건네기 좋게 포맷
 */
export function buildSetukUserMessage(args: {
  studentLabel: string
  gradeClass: string | null
  academicYear: number
  activities: ActivityInput[]
  extraKeywords?: string | null
}): string {
  const lines: string[] = []
  lines.push(
    `학생 라벨: ${args.studentLabel}${args.gradeClass ? ` (${args.gradeClass})` : ''}`
  )
  lines.push(`학년도: ${args.academicYear}학년도`)
  if (args.extraKeywords?.trim()) {
    lines.push(`추가 키워드/메모: ${args.extraKeywords.trim()}`)
  }
  lines.push('')
  lines.push('[참여 활동 목록]')
  if (args.activities.length === 0) {
    lines.push(
      '- (활동 참여 기록 없음. 입력 키워드 기반으로 최소한의 일반적 초안을 작성하되, 과장/추측 금지)'
    )
  } else {
    args.activities.forEach((a, i) => {
      const bytes = countNeisBytes(a.template ?? '')
      lines.push(
        `${i + 1}) ${a.program_date} · ${a.department} · ${a.program_name} (${bytes}B)`
      )
      if (a.template?.trim()) {
        lines.push(`   템플릿: ${a.template.trim()}`)
      }
    })
  }
  lines.push('')
  lines.push(
    '위 참여 정보를 종합해 해당 영역의 세특 초안을 한 문단으로 작성해줘.'
  )
  return lines.join('\n')
}
