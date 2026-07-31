-- ============================================================
-- SkillUp LMS — Migration 001: Core Tables
-- ============================================================

-- ============================================================
-- CURSOS, MÓDULOS E AULAS
-- ============================================================

CREATE TABLE lms_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  banner_url_desktop TEXT,
  banner_url_mobile TEXT,
  redirect_type TEXT DEFAULT 'default'
    CHECK (redirect_type IN ('default', 'url')),
  redirect_url TEXT,
  consent_force_modal BOOLEAN DEFAULT false,
  consent_terms_version TEXT,
  consent_terms_html TEXT,
  menu_order INT DEFAULT 0,
  status TEXT DEFAULT 'published'
    CHECK (status IN ('published', 'draft')),
  panda_drm_group_id TEXT,
  panda_drm_secret_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lms_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  drip_type TEXT DEFAULT 'immediate'
    CHECK (drip_type IN ('immediate', 'date', 'days')),
  drip_date DATE,
  drip_days INT,
  menu_order INT DEFAULT 0,
  status TEXT DEFAULT 'published'
    CHECK (status IN ('published', 'draft')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, slug)
);

CREATE TABLE lms_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES lms_modules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  drip_type TEXT DEFAULT 'immediate'
    CHECK (drip_type IN ('immediate', 'date', 'days')),
  drip_date DATE,
  drip_days INT,
  likes_count INT DEFAULT 0,
  dislikes_count INT DEFAULT 0,
  menu_order INT DEFAULT 0,
  duration_seconds INT,
  status TEXT DEFAULT 'published'
    CHECK (status IN ('published', 'draft')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, slug)
);

CREATE TABLE lms_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lms_lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  storage_path TEXT,
  menu_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ALUNOS E ASSINATURAS
-- ============================================================

CREATE TABLE lms_students (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  cpf_cnpj TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'student'
    CHECK (role IN ('student', 'admin')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lms_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES lms_students(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'past_due', 'trial')),
  provider TEXT
    CHECK (provider IS NULL OR provider IN ('hub_central', 'manual', 'csv_import', 'api')),
  provider_subscription_id TEXT,
  access_open BOOLEAN DEFAULT true,
  ignore_drip BOOLEAN DEFAULT false,
  starts_at TIMESTAMPTZ DEFAULT now(),
  ends_at TIMESTAMPTZ,
  paused_reason TEXT,
  status_raw TEXT,
  last_status_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, course_id, provider, provider_subscription_id)
);

-- ============================================================
-- PROGRESSO E CONSENTIMENTO
-- ============================================================

CREATE TABLE lms_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES lms_students(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lms_lessons(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  feedback TEXT
    CHECK (feedback IS NULL OR feedback IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, lesson_id)
);

CREATE TABLE lms_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES lms_students(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  signature_hash TEXT,
  consented_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, course_id, terms_version)
);

-- ============================================================
-- PESQUISAS / FORMULÁRIOS
-- ============================================================

CREATE TABLE lms_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  trigger_type TEXT DEFAULT 'immediate'
    CHECK (trigger_type IN ('immediate', 'module_start', 'module_complete', 'delay')),
  trigger_module_id UUID REFERENCES lms_modules(id) ON DELETE SET NULL,
  trigger_delay_seconds INT,
  course_id UUID REFERENCES lms_courses(id) ON DELETE SET NULL,
  re_show_new_questions BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lms_survey_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES lms_surveys(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('single', 'multiple', 'open', 'state_city')),
  options JSONB,
  required BOOLEAN DEFAULT false,
  menu_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lms_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES lms_surveys(id) ON DELETE CASCADE,
  student_id UUID REFERENCES lms_students(id) ON DELETE SET NULL,
  answers JSONB NOT NULL,
  ip_address INET,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- COMUNIDADE
-- ============================================================

CREATE TABLE lms_community_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  cover_url TEXT,
  course_id UUID REFERENCES lms_courses(id) ON DELETE SET NULL,
  privacy TEXT DEFAULT 'public'
    CHECK (privacy IN ('public', 'private', 'course_only')),
  max_members INT,
  created_by UUID REFERENCES lms_students(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lms_community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES lms_students(id) ON DELETE CASCADE,
  course_id UUID REFERENCES lms_courses(id) ON DELETE SET NULL,
  group_id UUID REFERENCES lms_community_groups(id) ON DELETE SET NULL,
  title TEXT,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'discussion'
    CHECK (type IN ('discussion', 'question', 'announcement', 'poll')),
  is_pinned BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  status TEXT DEFAULT 'published'
    CHECK (status IN ('published', 'hidden', 'flagged')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lms_community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES lms_community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES lms_students(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES lms_community_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  likes_count INT DEFAULT 0,
  status TEXT DEFAULT 'published'
    CHECK (status IN ('published', 'hidden', 'flagged')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lms_community_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES lms_students(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL
    CHECK (target_type IN ('post', 'comment')),
  target_id UUID NOT NULL,
  reaction TEXT DEFAULT 'like'
    CHECK (reaction IN ('like', 'love', 'insightful', 'celebrate')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE TABLE lms_community_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES lms_community_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES lms_students(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member'
    CHECK (role IN ('member', 'moderator', 'admin')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE lms_community_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES lms_community_posts(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  multiple_choice BOOLEAN DEFAULT false,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lms_community_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES lms_community_polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES lms_students(id) ON DELETE CASCADE,
  option_index INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, user_id, option_index)
);

CREATE TABLE lms_community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES lms_students(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL
    CHECK (target_type IN ('post', 'comment', 'user')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  reviewed_by UUID REFERENCES lms_students(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- NOTIFICAÇÕES
-- ============================================================

CREATE TABLE lms_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES lms_students(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- API PÚBLICA, WEBHOOKS E LOGS
-- ============================================================

CREATE TABLE lms_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  permissions JSONB DEFAULT '["read"]'::jsonb,
  rate_limit INT DEFAULT 100,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES lms_students(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lms_webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT[] NOT NULL,
  active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  failure_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lms_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES lms_webhook_endpoints(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INT,
  response_body TEXT,
  duration_ms INT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed')),
  attempts INT DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lms_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  student_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lms_import_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  data JSONB NOT NULL,
  row_hash TEXT UNIQUE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lms_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lms_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_lms_modules_course ON lms_modules(course_id);
CREATE INDEX idx_lms_lessons_course ON lms_lessons(course_id);
CREATE INDEX idx_lms_lessons_module ON lms_lessons(module_id);
CREATE INDEX idx_lms_materials_lesson ON lms_materials(lesson_id);
CREATE INDEX idx_lms_subscriptions_student ON lms_subscriptions(student_id);
CREATE INDEX idx_lms_subscriptions_course ON lms_subscriptions(course_id);
CREATE INDEX idx_lms_subscriptions_status ON lms_subscriptions(status);
CREATE INDEX idx_lms_progress_student ON lms_lesson_progress(student_id);
CREATE INDEX idx_lms_progress_course ON lms_lesson_progress(course_id);
CREATE INDEX idx_lms_consents_student ON lms_consents(student_id);
CREATE INDEX idx_lms_posts_author ON lms_community_posts(author_id);
CREATE INDEX idx_lms_posts_course ON lms_community_posts(course_id);
CREATE INDEX idx_lms_posts_group ON lms_community_posts(group_id);
CREATE INDEX idx_lms_posts_created ON lms_community_posts(created_at DESC);
CREATE INDEX idx_lms_comments_post ON lms_community_comments(post_id);
CREATE INDEX idx_lms_reactions_target ON lms_community_reactions(target_type, target_id);
CREATE INDEX idx_lms_notifications_user ON lms_notifications(user_id, read);
CREATE INDEX idx_lms_webhook_deliveries_status ON lms_webhook_deliveries(status);
CREATE INDEX idx_lms_access_logs_student ON lms_access_logs(student_id);
CREATE INDEX idx_lms_access_logs_created ON lms_access_logs(created_at DESC);
CREATE INDEX idx_lms_import_queue_status ON lms_import_queue(status);

-- ============================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION lms_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'lms_courses', 'lms_modules', 'lms_lessons',
      'lms_students', 'lms_subscriptions', 'lms_lesson_progress',
      'lms_surveys', 'lms_community_groups', 'lms_community_posts',
      'lms_community_comments', 'lms_webhook_endpoints', 'lms_plans',
      'lms_settings'
    ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION lms_set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- RLS: Enable on ALL tables
-- ============================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'lms_courses', 'lms_modules', 'lms_lessons', 'lms_materials',
      'lms_students', 'lms_subscriptions', 'lms_lesson_progress', 'lms_consents',
      'lms_surveys', 'lms_survey_questions', 'lms_survey_responses',
      'lms_community_groups', 'lms_community_posts', 'lms_community_comments',
      'lms_community_reactions', 'lms_community_group_members',
      'lms_community_polls', 'lms_community_poll_votes', 'lms_community_reports',
      'lms_notifications',
      'lms_api_keys', 'lms_webhook_endpoints', 'lms_webhook_deliveries',
      'lms_access_logs', 'lms_import_queue', 'lms_settings', 'lms_plans'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END;
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Helper: check if user is admin
CREATE OR REPLACE FUNCTION lms_is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM lms_students
    WHERE id = (SELECT auth.uid()) AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY INVOKER STABLE;

-- Courses: everyone can read published, admins can write
CREATE POLICY "Cursos: leitura pública" ON lms_courses
  FOR SELECT TO authenticated
  USING (status = 'published' OR lms_is_admin());

CREATE POLICY "Cursos: admin gerencia" ON lms_courses
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Modules: same as courses
CREATE POLICY "Módulos: leitura pública" ON lms_modules
  FOR SELECT TO authenticated
  USING (status = 'published' OR lms_is_admin());

CREATE POLICY "Módulos: admin gerencia" ON lms_modules
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Lessons: same as courses
CREATE POLICY "Aulas: leitura pública" ON lms_lessons
  FOR SELECT TO authenticated
  USING (status = 'published' OR lms_is_admin());

CREATE POLICY "Aulas: admin gerencia" ON lms_lessons
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Materials: authenticated can read, admins can write
CREATE POLICY "Materiais: leitura autenticada" ON lms_materials
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Materiais: admin gerencia" ON lms_materials
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Students: own profile or admin
CREATE POLICY "Alunos: ver próprio perfil" ON lms_students
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR lms_is_admin());

CREATE POLICY "Alunos: editar próprio perfil" ON lms_students
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Alunos: admin gerencia" ON lms_students
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

CREATE POLICY "Alunos: inserir próprio" ON lms_students
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

-- Subscriptions: own or admin
CREATE POLICY "Assinaturas: ver próprias" ON lms_subscriptions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = student_id OR lms_is_admin());

CREATE POLICY "Assinaturas: admin gerencia" ON lms_subscriptions
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Progress: own or admin
CREATE POLICY "Progresso: ver próprio" ON lms_lesson_progress
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = student_id OR lms_is_admin());

CREATE POLICY "Progresso: registrar próprio" ON lms_lesson_progress
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = student_id);

CREATE POLICY "Progresso: atualizar próprio" ON lms_lesson_progress
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = student_id)
  WITH CHECK ((SELECT auth.uid()) = student_id);

-- Consents: own or admin
CREATE POLICY "Consentimento: ver próprio" ON lms_consents
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = student_id OR lms_is_admin());

CREATE POLICY "Consentimento: registrar próprio" ON lms_consents
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = student_id);

-- Surveys: authenticated can read active, admins can manage
CREATE POLICY "Pesquisas: leitura ativas" ON lms_surveys
  FOR SELECT TO authenticated
  USING (active = true OR lms_is_admin());

CREATE POLICY "Pesquisas: admin gerencia" ON lms_surveys
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Survey questions: same as surveys
CREATE POLICY "Perguntas: leitura" ON lms_survey_questions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Perguntas: admin gerencia" ON lms_survey_questions
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Survey responses: own or admin
CREATE POLICY "Respostas: ver próprias" ON lms_survey_responses
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = student_id OR lms_is_admin());

CREATE POLICY "Respostas: enviar própria" ON lms_survey_responses
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = student_id);

-- Community posts: all authenticated can read published, own or admin can manage
CREATE POLICY "Posts: leitura" ON lms_community_posts
  FOR SELECT TO authenticated
  USING (status = 'published' OR (SELECT auth.uid()) = author_id OR lms_is_admin());

CREATE POLICY "Posts: criar" ON lms_community_posts
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = author_id);

CREATE POLICY "Posts: editar próprio" ON lms_community_posts
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = author_id OR lms_is_admin())
  WITH CHECK ((SELECT auth.uid()) = author_id OR lms_is_admin());

CREATE POLICY "Posts: admin remove" ON lms_community_posts
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = author_id OR lms_is_admin());

-- Comments: same pattern
CREATE POLICY "Comentários: leitura" ON lms_community_comments
  FOR SELECT TO authenticated
  USING (status = 'published' OR (SELECT auth.uid()) = author_id OR lms_is_admin());

CREATE POLICY "Comentários: criar" ON lms_community_comments
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = author_id);

CREATE POLICY "Comentários: editar próprio" ON lms_community_comments
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = author_id OR lms_is_admin())
  WITH CHECK ((SELECT auth.uid()) = author_id OR lms_is_admin());

CREATE POLICY "Comentários: remover" ON lms_community_comments
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = author_id OR lms_is_admin());

-- Reactions: own
CREATE POLICY "Reações: ver" ON lms_community_reactions
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Reações: criar" ON lms_community_reactions
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Reações: remover própria" ON lms_community_reactions
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Groups: public readable, admin manages
CREATE POLICY "Grupos: leitura" ON lms_community_groups
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Grupos: admin gerencia" ON lms_community_groups
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Group members: own membership or admin
CREATE POLICY "Membros: leitura" ON lms_community_group_members
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Membros: entrar" ON lms_community_group_members
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Membros: sair" ON lms_community_group_members
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR lms_is_admin());

-- Polls: readable by authenticated
CREATE POLICY "Enquetes: leitura" ON lms_community_polls
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Enquetes: admin gerencia" ON lms_community_polls
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Poll votes: own
CREATE POLICY "Votos: ver" ON lms_community_poll_votes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Votos: votar" ON lms_community_poll_votes
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Reports: own or admin
CREATE POLICY "Denúncias: criar" ON lms_community_reports
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = reporter_id);

CREATE POLICY "Denúncias: admin vê" ON lms_community_reports
  FOR SELECT TO authenticated
  USING (lms_is_admin());

CREATE POLICY "Denúncias: admin gerencia" ON lms_community_reports
  FOR UPDATE TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Notifications: own
CREATE POLICY "Notificações: ver próprias" ON lms_notifications
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Notificações: marcar lida" ON lms_notifications
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- API Keys: admin only
CREATE POLICY "API Keys: admin" ON lms_api_keys
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Webhook endpoints: admin only
CREATE POLICY "Webhooks: admin" ON lms_webhook_endpoints
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Webhook deliveries: admin only
CREATE POLICY "Deliveries: admin" ON lms_webhook_deliveries
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Access logs: admin only
CREATE POLICY "Logs: admin" ON lms_access_logs
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Import queue: admin only
CREATE POLICY "Importação: admin" ON lms_import_queue
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Settings: admin only
CREATE POLICY "Configurações: admin lê" ON lms_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Configurações: admin gerencia" ON lms_settings
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());

-- Plans: everyone reads, admin manages
CREATE POLICY "Planos: leitura" ON lms_plans
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Planos: admin gerencia" ON lms_plans
  FOR ALL TO authenticated
  USING (lms_is_admin())
  WITH CHECK (lms_is_admin());
