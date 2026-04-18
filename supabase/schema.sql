-- ============================================================
-- 덕수고 AI 온라인 교무실 — Phase 0 스키마 (리뷰 반영 버전)
-- 빈 Supabase 프로젝트에서 실행하는 것을 가정합니다.
-- ============================================================

-- ============================================================
-- 1. 교사 (teachers)
-- ============================================================
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department TEXT,
  role TEXT DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin', 'superadmin')),
  subject TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. 학생 (정규화: profiles + enrollments + homeroom)
-- ============================================================

-- 고정 신원 (학번은 불변)
CREATE TABLE student_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_number TEXT UNIQUE NOT NULL, -- 학번 (고유, 불변)
  name TEXT NOT NULL, -- 검색용 평문 (학교 내부 네트워크)
  name_encrypted BYTEA, -- AES-256 암호화 (외부 전송용)
  gender TEXT,
  admission_year INTEGER NOT NULL, -- 입학년도
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL, -- 학생 로그인용
  password_changed BOOLEAN DEFAULT false, -- 초기 비밀번호 변경 여부
  is_active BOOLEAN DEFAULT true, -- false = 졸업/전출
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 학년도별 소속 (매년 INSERT, UPDATE 아님)
CREATE TABLE student_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  academic_year INTEGER NOT NULL, -- 2026
  grade INTEGER NOT NULL, -- 1, 2, 3
  class_number INTEGER NOT NULL, -- 반
  number_in_class INTEGER, -- 번호
  is_current BOOLEAN DEFAULT true, -- 현재 학년도 여부
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, academic_year)
);

-- 담임 배정 (학년도 + 학년 + 반 단위)
CREATE TABLE homeroom_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year INTEGER NOT NULL,
  grade INTEGER NOT NULL,
  class_number INTEGER NOT NULL,
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(academic_year, grade, class_number)
);

-- ============================================================
-- 3. 캘린더 일정
-- ============================================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT true,
  color TEXT DEFAULT 'blue',
  event_type TEXT DEFAULT 'personal' CHECK (event_type IN ('personal', 'shared', 'school')),
  created_by UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, shared_with)
);

-- ============================================================
-- 4. AI 대화 이력 (본인만 접근, 관리자도 불가)
-- ============================================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title TEXT,
  model TEXT DEFAULT 'claude-haiku-4-5',
  feature TEXT DEFAULT 'chat' CHECK (feature IN ('chat', 'setuk', 'review', 'rules', 'consult', 'calendar', 'activity')),
  is_agent_session BOOLEAN DEFAULT false,
  agent_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  attachments JSONB,
  token_input INTEGER,
  token_output INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. 세특 초안 + 비식별화 매핑
-- ============================================================
CREATE TABLE setuk_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  student_id UUID REFERENCES student_profiles(id),
  student_label TEXT NOT NULL, -- 비식별 라벨
  academic_year INTEGER NOT NULL,
  subject TEXT NOT NULL,
  grade_class TEXT,
  keywords TEXT,
  draft TEXT,
  final_text TEXT,
  byte_limit INTEGER DEFAULT 500,
  byte_used INTEGER,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'finalized')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  real_name_encrypted BYTEA NOT NULL,
  label TEXT NOT NULL,
  grade_class TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. 세특입력활동 (프로그램 + 참가자)
-- ============================================================
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  department TEXT NOT NULL,
  program_date DATE NOT NULL,
  program_name TEXT NOT NULL,
  setuk_template TEXT, -- 특기사항 예시
  record_category TEXT, -- 학생부 기재 항목명
  target_grade TEXT, -- 참여학년
  byte_limit INTEGER DEFAULT 500,
  teacher_id UUID REFERENCES teachers(id),
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE program_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  participant_order INTEGER,
  checked_in BOOLEAN DEFAULT false,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, student_id)
);

-- ============================================================
-- 7. 학부모 상담 기록
-- ============================================================
CREATE TABLE consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES student_profiles(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  academic_year INTEGER NOT NULL,
  consultation_date DATE NOT NULL,
  attendees TEXT,
  raw_input TEXT,
  structured_summary JSONB, -- {agenda, details, agreements, follow_up, follow_up_date}
  follow_up_date DATE,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. 학교 규정 문서 (버저닝 + 청크)
-- ============================================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('regulation', 'plan', 'assignment', 'calendar', 'other')),
  uploaded_by UUID REFERENCES teachers(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  storage_path TEXT, -- Supabase Storage 경로
  effective_date DATE, -- 시행일
  is_current BOOLEAN DEFAULT true, -- 현재 효력 여부
  full_text TEXT, -- 전체 텍스트 (추출)
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, version)
);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  heading TEXT, -- 조항/섹션 제목
  content TEXT NOT NULL,
  page_no INTEGER,
  token_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. 공지사항
-- ============================================================
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_by UUID REFERENCES teachers(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. 운영 로그 (분리: 사용량 + AI 요청 + 감사)
-- ============================================================

-- 비용 집계용
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  feature TEXT NOT NULL,
  model TEXT,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI 요청 상세 (캐시 효과 확인, 디버깅)
CREATE TABLE ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  latency_ms INTEGER,
  status TEXT CHECK (status IN ('success', 'error', 'timeout')),
  cache_hit BOOLEAN DEFAULT false,
  cache_read_tokens INTEGER DEFAULT 0,
  provider_request_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 관리자 행위 추적
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES teachers(id),
  action TEXT NOT NULL, -- 'role_change', 'csv_import', 'document_upload', 'student_bulk_create', etc.
  target_type TEXT, -- 'teacher', 'student', 'document', etc.
  target_id UUID,
  details JSONB, -- 변경 전후 데이터
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. 비동기 작업 큐
-- ============================================================
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'csv_import', 'setuk_batch', 'docx_export', 'document_extract', 'handover_report'
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  input_data JSONB, -- 작업 입력 파라미터
  result_data JSONB, -- 완료 시 결과 (파일 경로 등)
  error_message TEXT,
  progress INTEGER DEFAULT 0, -- 0~100
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS 정책 (보안 수정 반영)
-- ============================================================

-- 모든 테이블 RLS 활성화
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeroom_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE setuk_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- 헬퍼 함수: 현재 로그인 교사의 teacher.id
CREATE OR REPLACE FUNCTION current_teacher_id() RETURNS UUID AS $$
  SELECT id FROM teachers WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM teachers WHERE auth_user_id = auth.uid() AND role IN ('admin', 'superadmin'));
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- teachers: 전체 조회, 자기만 수정, 관리자만 role 변경
CREATE POLICY "teachers_read" ON teachers FOR SELECT USING (true);
CREATE POLICY "teachers_update_own" ON teachers FOR UPDATE USING (auth_user_id = auth.uid());

-- student_profiles/enrollments: 로그인 교사 전체 조회
CREATE POLICY "students_read" ON student_profiles FOR SELECT USING (true);
CREATE POLICY "students_admin_write" ON student_profiles FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "students_admin_update" ON student_profiles FOR UPDATE USING (is_admin());
CREATE POLICY "enrollments_read" ON student_enrollments FOR SELECT USING (true);
CREATE POLICY "enrollments_admin_write" ON student_enrollments FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "homeroom_read" ON homeroom_assignments FOR SELECT USING (true);
CREATE POLICY "homeroom_admin_write" ON homeroom_assignments FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "homeroom_admin_update" ON homeroom_assignments FOR UPDATE USING (is_admin());

-- events: 자기 일정 CRUD + 전체 일정 조회
CREATE POLICY "events_own_crud" ON events FOR ALL USING (created_by = current_teacher_id());
CREATE POLICY "events_school_read" ON events FOR SELECT USING (event_type = 'school');
CREATE POLICY "events_shared_read" ON events FOR SELECT USING (
  id IN (SELECT event_id FROM event_shares WHERE shared_with = current_teacher_id())
);

-- event_shares: 공유받은 것 조회, 자기 일정의 공유만 생성
CREATE POLICY "shares_read" ON event_shares FOR SELECT USING (shared_with = current_teacher_id());
CREATE POLICY "shares_create" ON event_shares FOR INSERT WITH CHECK (
  event_id IN (SELECT id FROM events WHERE created_by = current_teacher_id())
);

-- ★ AI 대화: 본인만 접근 (관리자도 불가)
CREATE POLICY "conv_own" ON conversations FOR ALL USING (teacher_id = current_teacher_id());
CREATE POLICY "msg_own" ON messages FOR ALL USING (
  conversation_id IN (SELECT id FROM conversations WHERE teacher_id = current_teacher_id())
);

-- 세특 초안 + 매핑: 본인만
CREATE POLICY "setuk_own" ON setuk_drafts FOR ALL USING (teacher_id = current_teacher_id());
CREATE POLICY "mapping_own" ON student_mappings FOR ALL USING (teacher_id = current_teacher_id());

-- 프로그램: 전체 조회, 담당자 또는 관리자만 쓰기
CREATE POLICY "programs_read" ON programs FOR SELECT USING (true);
CREATE POLICY "programs_create" ON programs FOR INSERT WITH CHECK (
  teacher_id = current_teacher_id() OR is_admin()
);
CREATE POLICY "programs_update" ON programs FOR UPDATE USING (
  teacher_id = current_teacher_id() OR is_admin()
);
CREATE POLICY "programs_delete" ON programs FOR DELETE USING (
  teacher_id = current_teacher_id() OR is_admin()
);

-- 참가자: 전체 조회, 프로그램 담당자/관리자만 수정
CREATE POLICY "participants_read" ON program_participants FOR SELECT USING (true);
CREATE POLICY "participants_create" ON program_participants FOR INSERT WITH CHECK (
  program_id IN (SELECT id FROM programs WHERE teacher_id = current_teacher_id()) OR is_admin()
);
CREATE POLICY "participants_delete" ON program_participants FOR DELETE USING (
  program_id IN (SELECT id FROM programs WHERE teacher_id = current_teacher_id()) OR is_admin()
);

-- 상담: 작성자 또는 현 학년도 담임
CREATE POLICY "consult_read" ON consultations FOR SELECT USING (
  teacher_id = current_teacher_id()
  OR student_id IN (
    SELECT se.student_id FROM student_enrollments se
    JOIN homeroom_assignments ha ON se.academic_year = ha.academic_year
      AND se.grade = ha.grade AND se.class_number = ha.class_number
    WHERE ha.teacher_id = current_teacher_id() AND se.is_current = true
  )
);
CREATE POLICY "consult_create" ON consultations FOR INSERT WITH CHECK (teacher_id = current_teacher_id());
CREATE POLICY "consult_update" ON consultations FOR UPDATE USING (teacher_id = current_teacher_id());

-- 규정 문서: 전체 조회, 관리자만 관리
CREATE POLICY "docs_read" ON documents FOR SELECT USING (true);
CREATE POLICY "docs_admin_write" ON documents FOR ALL USING (is_admin());
CREATE POLICY "doc_versions_read" ON document_versions FOR SELECT USING (true);
CREATE POLICY "doc_versions_admin_write" ON document_versions FOR ALL USING (is_admin());
CREATE POLICY "doc_chunks_read" ON document_chunks FOR SELECT USING (true);
CREATE POLICY "doc_chunks_admin_write" ON document_chunks FOR ALL USING (is_admin());

-- 공지: 전체 조회, 관리자만 CRUD
CREATE POLICY "announce_read" ON announcements FOR SELECT USING (true);
CREATE POLICY "announce_admin_crud" ON announcements FOR ALL USING (is_admin());

-- 사용량/AI요청: 관리자는 통계만, 일반 교사는 자기 것만
CREATE POLICY "usage_own" ON usage_logs FOR SELECT USING (teacher_id = current_teacher_id() OR is_admin());
CREATE POLICY "usage_create" ON usage_logs FOR INSERT WITH CHECK (teacher_id = current_teacher_id());
CREATE POLICY "ai_req_own" ON ai_requests FOR SELECT USING (teacher_id = current_teacher_id() OR is_admin());
CREATE POLICY "ai_req_create" ON ai_requests FOR INSERT WITH CHECK (teacher_id = current_teacher_id());

-- 감사로그: 관리자만 조회, 시스템이 생성
CREATE POLICY "audit_admin_read" ON audit_logs FOR SELECT USING (is_admin());
CREATE POLICY "audit_create" ON audit_logs FOR INSERT WITH CHECK (actor_id = current_teacher_id());

-- 작업큐: 본인만
CREATE POLICY "jobs_own" ON jobs FOR ALL USING (teacher_id = current_teacher_id());

-- ============================================================
-- 뷰 (security_invoker = true)
-- ============================================================
CREATE OR REPLACE VIEW student_participation_summary
WITH (security_invoker = true)
AS
SELECT
  sp.id AS student_id,
  sp.name,
  sp.student_number,
  se.academic_year,
  se.grade,
  se.class_number,
  se.number_in_class,
  COUNT(pp.id) AS total_participations,
  ARRAY_AGG(DISTINCT p.department) FILTER (WHERE p.department IS NOT NULL) AS departments,
  JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'program_name', p.program_name,
      'program_date', p.program_date,
      'department', p.department,
      'setuk_template', p.setuk_template,
      'record_category', p.record_category
    )
  ) FILTER (WHERE p.id IS NOT NULL) AS participated_programs,
  PERCENT_RANK() OVER (
    PARTITION BY se.grade
    ORDER BY COUNT(pp.id) DESC
  ) AS participation_percentile
FROM student_profiles sp
JOIN student_enrollments se ON sp.id = se.student_id AND se.is_current = true
LEFT JOIN program_participants pp ON sp.id = pp.student_id
LEFT JOIN programs p ON pp.program_id = p.id AND p.academic_year = se.academic_year
WHERE sp.is_active = true
GROUP BY sp.id, sp.name, sp.student_number, se.academic_year, se.grade, se.class_number, se.number_in_class;

-- ============================================================
-- Auth trigger
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.teachers (auth_user_id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
