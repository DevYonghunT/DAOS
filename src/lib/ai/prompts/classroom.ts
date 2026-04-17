export const DEFAULT_CLASSROOM_PERSONA = `너는 덕수고등학교 학생들의 학습을 돕는 AI 조교야.
친절하고 교육적으로 답변해줘.
모르는 내용은 솔직히 모른다고 말해.
학생을 존중하고 격려하는 말투를 사용해.
답변은 한국어로, 학생 수준에 맞게 쉽게 설명해.`

type RoomInfo = {
  title: string
  subject: string | null
  grade: number | null
  classNumber: number | null
  personaPrompt: string | null
  teacherName: string
  memberCount: number
}

type Attachment = {
  filename: string
  fullText: string | null
  tokenCount: number | null
}

export function buildClassroomSystemPrompt(
  room: RoomInfo,
  attachments: Attachment[]
): string {
  const persona = room.personaPrompt?.trim() || DEFAULT_CLASSROOM_PERSONA

  const parts: string[] = [persona]

  // 방 정보
  const roomMeta = [
    `방 제목: ${room.title}`,
    room.subject ? `주제: ${room.subject}` : null,
    room.grade ? `학년/반: ${room.grade}학년 ${room.classNumber ?? ''}반` : null,
    `교사: ${room.teacherName}`,
    `참여 학생: ${room.memberCount}명`,
  ]
    .filter(Boolean)
    .join('\n')

  parts.push(`\n[방 정보]\n${roomMeta}`)

  // 참고 자료
  if (attachments.length > 0) {
    const docSection = attachments
      .filter((a) => a.fullText?.trim())
      .map(
        (a) =>
          `### ${a.filename} (${a.tokenCount?.toLocaleString() ?? '?'} tokens)\n\n${a.fullText!.slice(0, 80000)}`
      )
      .join('\n\n---\n\n')
    if (docSection) {
      parts.push(`\n[참고 자료]\n아래 자료를 우선 참고하여 답변하세요.\n\n${docSection}`)
    }
  }

  parts.push(`\n[대화 규칙]
- 학생이 @AI로 멘션한 질문에만 답변합니다.
- 참고 자료가 있으면 그 내용을 우선 인용하여 답변하세요.
- 답변에 출처(자료명·페이지·섹션)를 명시하면 좋습니다.
- 학생 이름을 자연스럽게 불러주세요.
- 한국어로 친근하게, 교육적으로 답변하세요.
- 모르는 내용은 추측하지 말고 "잘 모르겠어요"라고 하세요.`)

  return parts.join('\n')
}
