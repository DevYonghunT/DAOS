/**
 * 학생부 세특 기재 금지/주의 표현 사전
 *
 * 2026 학교생활기록부 기재요령 기준:
 *  - 순위·석차 기재 금지
 *  - 수상 실적 직접 기재 금지 (수상경력 영역에만)
 *  - 구체적 대학명/학과명 언급 주의
 *  - 외부 기관·대회 상세 기재 제한
 *  - 어학 인증(토익·토플 등) 기재 금지
 *  - 비교·최상급 표현 금지 (객관적·중립적 묘사)
 */

export type Severity = 'error' | 'warning'
export type ViolationType = 'forbidden' | 'caution' | 'length'

export type PatternRule = {
  id: string
  /** RegExp — 반드시 /g 플래그 포함 */
  pattern: RegExp
  type: ViolationType
  severity: Severity
  /** 사용자에게 보여줄 짧은 사유 */
  reason: string
  /** 상세 가이드 (hover/expand 시 노출) */
  guide?: string
}

export const FORBIDDEN_PATTERNS: PatternRule[] = [
  // ── 순위/석차 ──────────────────────────────────────────────
  {
    id: 'rank-num',
    pattern: /(\d+)\s*(등|위)(?![학년반생])/g,
    type: 'forbidden',
    severity: 'error',
    reason: '순위·석차 기재 금지',
    guide: '구체적인 순위(1등, 3위 등)는 기재할 수 없습니다.',
  },
  {
    id: 'rank-word',
    pattern: /(수석|차석|석차|일등|이등|삼등)/g,
    type: 'forbidden',
    severity: 'error',
    reason: '순위 표현 금지',
    guide: '수석·차석·석차 등 순위를 암시하는 표현은 금지.',
  },
  {
    id: 'school-rank',
    pattern: /전교\s*(\d+\s*(등|위)|최고|최우수|수석|1등)/g,
    type: 'forbidden',
    severity: 'error',
    reason: '전교 순위 기재 금지',
  },

  // ── 수상·입상 ──────────────────────────────────────────────
  {
    id: 'award',
    pattern: /(수상|입상|당선|우승|금상|은상|동상|대상|최우수상|우수상)/g,
    type: 'caution',
    severity: 'warning',
    reason: '수상 실적은 「수상경력」 영역에만',
    guide:
      '창의적 체험활동·교과세특에서는 수상 사실을 직접 기재하지 않습니다. 학생의 활동 과정과 배움을 기술하세요.',
  },

  // ── 비교·최상급 ───────────────────────────────────────────
  {
    id: 'compare-1',
    pattern: /(보다|보단)\s*(더\s*)?(뛰어|우수|잘|낫|우월)/g,
    type: 'forbidden',
    severity: 'error',
    reason: '비교 표현 금지',
    guide: '타 학생과 비교하는 표현은 사용할 수 없습니다.',
  },
  {
    id: 'compare-2',
    pattern: /가장\s*(뛰어|우수|잘|우월|탁월|빼어)/g,
    type: 'forbidden',
    severity: 'error',
    reason: '최상급 비교 금지',
  },
  {
    id: 'superlative',
    pattern: /(최고|최우수|최상|최상위|타의\s*추종)/g,
    type: 'forbidden',
    severity: 'error',
    reason: '최상급 표현 금지',
  },
  {
    id: 'rank-percent',
    pattern: /상위\s*\d+\s*(%|퍼센트|프로)/g,
    type: 'forbidden',
    severity: 'error',
    reason: '상위 n% 기재 금지',
  },

  // ── 어학 인증 / 공인 시험 ─────────────────────────────────
  {
    id: 'cert-lang',
    pattern: /(토익|토플|텝스|아이엘츠|TOEIC|TOEFL|TEPS|IELTS|OPIc|HSK)/gi,
    type: 'forbidden',
    severity: 'error',
    reason: '어학 인증 기재 금지',
  },
  {
    id: 'cert-score',
    pattern: /(\d{3,4}\s*점)/g,
    type: 'caution',
    severity: 'warning',
    reason: '시험 점수 기재 주의 (모의고사·공인시험 점수 금지)',
  },

  // ── 대학명 직접 언급 ─────────────────────────────────────
  {
    id: 'uni-top',
    pattern:
      /(서울대|연세대|고려대|카이스트|포스텍|KAIST|POSTECH|한양대|성균관대|이화여대)/g,
    type: 'caution',
    severity: 'warning',
    reason: '대학명 직접 언급 주의',
    guide: '특정 대학명은 진로·학업 계획 맥락에서만 신중히 사용하세요.',
  },

  // ── 외부 기관/대회 ───────────────────────────────────────
  {
    id: 'external-contest',
    pattern: /(교외|외부|민간)\s*(대회|공모전|경진대회|경시|올림피아드)/g,
    type: 'caution',
    severity: 'warning',
    reason: '교외 대회 상세 기재 제한',
  },

  // ── 논문/소논문 ──────────────────────────────────────────
  {
    id: 'paper',
    pattern: /(소논문|R&E|research\s*and\s*education)/gi,
    type: 'forbidden',
    severity: 'error',
    reason: '소논문·R&E 기재 금지',
  },

  // ── 부모·가정환경 ────────────────────────────────────────
  {
    id: 'family',
    pattern: /(아버지|어머니|부모님|가정|한부모|조부모)\s*(이|가|의|께서|는|와)/g,
    type: 'caution',
    severity: 'warning',
    reason: '가정환경·부모 정보 언급 주의',
    guide: '가정환경·부모 직업·경제 상태 등 사생활 정보는 기재 제한.',
  },

  // ── 학교폭력 / 징계 ─────────────────────────────────────
  {
    id: 'discipline',
    pattern: /(학교폭력|징계|처벌|체벌)/g,
    type: 'caution',
    severity: 'warning',
    reason: '징계·학폭 관련 표현 검토 필요',
  },
]
