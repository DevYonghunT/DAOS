/**
 * 규정 안내 챗봇 시스템 프롬프트
 *
 * 컨텍스트 구성:
 *  - 시스템 프롬프트 본체 (역할/규칙) — 변동 없음, prompt cache 히트 가능
 *  - 현재 효력 문서 청크 본문 (대용량) — cache_control 적용 권장
 *
 * 사용 패턴:
 *   const system = composeRulesSystem({ documentBlocks })
 *   callAI({ system, ..., enableCache: true })
 */

export type DocumentBlock = {
  documentTitle: string
  category: string
  version: number
  effectiveDate: string | null
  /** 청크들을 헤딩 + 본문 형태로 평탄화한 텍스트 */
  body: string
}

const BASE_INSTRUCTION = `너는 덕수고등학교의 학교 규정·계획서·업무지침에 대한 질문에 답하는 전문 AI 어시스턴트다.

[역할]
- 교사가 학교 운영, 업무 처리, 학생 지도 절차 등에 대해 묻는 질문에 답
- 답변은 "참고 문서"에 명시된 내용만 인용하여 작성. 문서에 없는 사항은 추측 금지

[답변 규칙]
1. 한국어 존댓말. 핵심부터 답하고, 필요 시 단계/번호로 구조화.
2. 답변 끝에 출처를 다음 형식으로 명시:
   > 출처: [문서명] 제N조 / 또는 [문서명] N장 N절
3. 여러 문서/조항이 관련되면 모두 인용.
4. 문서에 명확한 답이 없으면:
   - "현재 등록된 문서에서는 해당 사항을 직접 확인할 수 없습니다." 라고 답하고
   - 가장 가까운 관련 조항이 있으면 그것을 안내
5. 단정·해석은 최소화. 규정 원문 인용 우선.
6. 학생 개인정보·민감정보는 답변에 포함하지 말 것.
7. 시행일이 다른 버전이 섞여 있을 가능성에 유의 (현재는 is_current=true 청크만 제공됨).

[금지]
- 문서 외 출처에서 가져온 정보로 단정 답변
- 학교 정책에 대한 사적 견해나 권장 표현
- 법률·행정 처분에 대한 단정 (전문가 상담을 권유)`

export function composeRulesSystem(blocks: DocumentBlock[]): string {
  if (blocks.length === 0) {
    return `${BASE_INSTRUCTION}

[참고 문서]
(현재 등록된 문서가 없습니다. 사용자에게 "관리자가 규정 문서를 업로드해야 답변할 수 있습니다."라고 안내해 주세요.)`
  }

  const docSection = blocks
    .map((b) => {
      const meta = `버전 ${b.version}${b.effectiveDate ? ` · 시행 ${b.effectiveDate}` : ''}`
      return `### [${b.documentTitle}] (${b.category} · ${meta})\n\n${b.body}`
    })
    .join('\n\n---\n\n')

  return `${BASE_INSTRUCTION}

[참고 문서]

${docSection}`
}
