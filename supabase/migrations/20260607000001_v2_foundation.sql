-- EduConnect v2.0 foundation — Mode B (AI Masterclass Hub)
-- Builds on v1.1. Mode A is preserved unchanged:
--   role='teacher'  -> Abdul Rafay (admin, both modes)
--   role='student'  -> the DTU 1:1 student (PRD's "student_private")
--   role='student_group' (NEW) -> Mode B cousins, self-registered via Google OAuth
-- We intentionally keep the existing 'student' value for the private student
-- rather than renaming to 'student_private', because ~20 frontend call sites and
-- all working RLS treat role='student' as Mode A. Renaming would be pure
-- regression risk. The PRD's student_private == role 'student' here.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Role model: widen the profiles.role CHECK to admit student_group
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('teacher', 'student', 'student_group'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. profiles columns for Mode B (avatar_url already exists from initial schema)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_group           text CHECK (age_group IN ('little_ones','juniors','advanced')),
  ADD COLUMN IF NOT EXISTS cohort_id           uuid,
  ADD COLUMN IF NOT EXISTS google_id           text,
  ADD COLUMN IF NOT EXISTS email_notifications boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;

-- Existing Mode A users (teacher + private student) are already onboarded.
UPDATE public.profiles SET onboarding_complete = true WHERE role IN ('teacher','student');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. cohorts (the three age groups running the 12-week curriculum)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cohorts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  age_group  text NOT NULL CHECK (age_group IN ('little_ones','juniors','advanced')),
  is_active  boolean DEFAULT true,
  start_date date,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- profiles.cohort_id FK now that cohorts exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cohort') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT fk_cohort FOREIGN KEY (cohort_id) REFERENCES public.cohorts(id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. masterclass_sessions (Mode B equivalent of sessions)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.masterclass_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number          int NOT NULL CHECK (week_number BETWEEN 1 AND 12),
  title                text NOT NULL,
  session_type         text NOT NULL DEFAULT 'class'
                         CHECK (session_type IN ('class','quiz_session','demo_day','office_hours')),
  scheduled_at         timestamptz NOT NULL,
  duration_min         int DEFAULT 120,
  meeting_link         text NOT NULL,
  cohort_ids           uuid[] DEFAULT '{}',
  agenda_md            text,
  activity_little_ones text,
  activity_juniors     text,
  activity_advanced    text,
  tools_needed         jsonb,                  -- [{name, url}]
  recording_url        text,
  summary_md           text,
  status               text DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled','live','completed','cancelled')),
  created_by           uuid REFERENCES public.profiles(id),
  created_at           timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. masterclass_attendance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.masterclass_attendance (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.masterclass_sessions(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at  timestamptz,
  UNIQUE (session_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. masterclass_quizzes (separate from Mode A quizzes)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.masterclass_quizzes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number  int NOT NULL,
  title        text NOT NULL,
  description  text,
  quiz_type    text NOT NULL CHECK (quiz_type IN ('knowledge_check','hands_on_challenge','reflection')),
  cohort_ids   uuid[] DEFAULT '{}',
  due_date     timestamptz NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('inline','file')),
  questions    jsonb,            -- inline: [{question, type, options, correct}]
  file_path    text,            -- file-based
  max_score    int DEFAULT 10,
  created_by   uuid REFERENCES public.profiles(id),
  created_at   timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. masterclass_submissions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.masterclass_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id      uuid NOT NULL REFERENCES public.masterclass_quizzes(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answers      jsonb,           -- inline: [{question_id, answer}]
  file_path    text,            -- file-based
  submitted_at timestamptz DEFAULT now(),
  score        numeric(5,2),
  feedback     text,
  graded_at    timestamptz,
  graded_by    uuid REFERENCES public.profiles(id),
  status       text DEFAULT 'submitted' CHECK (status IN ('submitted','graded')),
  UNIQUE (quiz_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. certificates
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.certificates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cohort_id      uuid NOT NULL REFERENCES public.cohorts(id),
  issued_at      timestamptz DEFAULT now(),
  pdf_path       text NOT NULL,
  sessions_count int,
  quizzes_count  int,
  UNIQUE (user_id, cohort_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. email_queue (async dispatch; consumed by Phase 4 dispatch_emails fn)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_queue (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES public.profiles(id),
  template     text NOT NULL,
  payload      jsonb NOT NULL,
  send_at      timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz,
  status       text DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  error        text,
  created_at   timestamptz DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS email_queue_pending_idx
  ON public.email_queue (send_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS masterclass_sessions_scheduled_idx
  ON public.masterclass_sessions (scheduled_at);
CREATE INDEX IF NOT EXISTS masterclass_quizzes_due_date_idx
  ON public.masterclass_quizzes (due_date);
CREATE INDEX IF NOT EXISTS profiles_cohort_idx
  ON public.profiles (cohort_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Helper: current user's cohort id (SECURITY DEFINER, avoids RLS recursion)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_cohort_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT cohort_id FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_cohort_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_cohort_id() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. RLS — enable + policies for all new tables (see PRD §11.2)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.cohorts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.masterclass_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.masterclass_attendance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.masterclass_quizzes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.masterclass_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue             ENABLE ROW LEVEL SECURITY;

-- cohorts: teacher full CRUD; student SELECT own cohort
CREATE POLICY "Teacher full cohorts" ON public.cohorts
  FOR ALL TO authenticated
  USING (public.is_teacher(auth.uid())) WITH CHECK (public.is_teacher(auth.uid()));
CREATE POLICY "Student read own cohort" ON public.cohorts
  FOR SELECT TO authenticated
  USING (id = public.current_cohort_id());

-- masterclass_sessions: teacher full CRUD; student SELECT where their cohort is targeted
CREATE POLICY "Teacher full mc_sessions" ON public.masterclass_sessions
  FOR ALL TO authenticated
  USING (public.is_teacher(auth.uid())) WITH CHECK (public.is_teacher(auth.uid()));
CREATE POLICY "Student read cohort mc_sessions" ON public.masterclass_sessions
  FOR SELECT TO authenticated
  USING (public.current_cohort_id() = ANY (cohort_ids));

-- masterclass_attendance: teacher full CRUD; student INSERT/SELECT own
CREATE POLICY "Teacher full mc_attendance" ON public.masterclass_attendance
  FOR ALL TO authenticated
  USING (public.is_teacher(auth.uid())) WITH CHECK (public.is_teacher(auth.uid()));
CREATE POLICY "Student read own mc_attendance" ON public.masterclass_attendance
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Student insert own mc_attendance" ON public.masterclass_attendance
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- masterclass_quizzes: teacher full CRUD; student SELECT where their cohort is targeted
CREATE POLICY "Teacher full mc_quizzes" ON public.masterclass_quizzes
  FOR ALL TO authenticated
  USING (public.is_teacher(auth.uid())) WITH CHECK (public.is_teacher(auth.uid()));
CREATE POLICY "Student read cohort mc_quizzes" ON public.masterclass_quizzes
  FOR SELECT TO authenticated
  USING (public.current_cohort_id() = ANY (cohort_ids));

-- masterclass_submissions: teacher full CRUD; student INSERT/SELECT/UPDATE own
CREATE POLICY "Teacher full mc_submissions" ON public.masterclass_submissions
  FOR ALL TO authenticated
  USING (public.is_teacher(auth.uid())) WITH CHECK (public.is_teacher(auth.uid()));
CREATE POLICY "Student read own mc_submissions" ON public.masterclass_submissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Student insert own mc_submissions" ON public.masterclass_submissions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Student update own mc_submissions" ON public.masterclass_submissions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- certificates: teacher SELECT all; student SELECT own (writes via service role/definer)
CREATE POLICY "Teacher read certificates" ON public.certificates
  FOR SELECT TO authenticated USING (public.is_teacher(auth.uid()));
CREATE POLICY "Student read own certificates" ON public.certificates
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- email_queue: service role only (Edge Function bypasses RLS); teacher SELECT for monitoring
CREATE POLICY "Teacher read email_queue" ON public.email_queue
  FOR SELECT TO authenticated USING (public.is_teacher(auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Storage buckets + RLS (all private)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('masterclass-materials', 'masterclass-materials', false),
  ('masterclass-submissions', 'masterclass-submissions', false),
  ('certificates', 'certificates', false)
ON CONFLICT (id) DO NOTHING;

-- masterclass-materials: authenticated read, teacher write/delete
CREATE POLICY "Authenticated read mc-materials" ON storage.objects
  FOR SELECT USING (bucket_id = 'masterclass-materials' AND auth.role() = 'authenticated');
CREATE POLICY "Teacher write mc-materials" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'masterclass-materials' AND public.is_teacher(auth.uid()));
CREATE POLICY "Teacher delete mc-materials" ON storage.objects
  FOR DELETE USING (bucket_id = 'masterclass-materials' AND public.is_teacher(auth.uid()));

-- masterclass-submissions: student writes own `<user_id>/...` folder; read own or teacher
CREATE POLICY "Student write own mc-submissions" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'masterclass-submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Read own mc-submissions or teacher" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'masterclass-submissions'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_teacher(auth.uid()))
  );

-- certificates: student reads own `<user_id>/...`; teacher reads all (writes via service role)
CREATE POLICY "Read own certificate or teacher" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'certificates'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_teacher(auth.uid()))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. Auth trigger: auto-provision a student_group profile for Google sign-ups
--     Only fires for provider='google' AND when no profile row exists yet, so
--     email/admin-created Mode A accounts (teacher, DTU student) are untouched.
--     Onboarding (/onboarding) later fills age_group + cohort and flips
--     onboarding_complete=true.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.raw_app_meta_data->>'provider') = 'google'
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    INSERT INTO public.profiles (
      id, role, full_name, email, avatar_url, google_id,
      onboarding_complete, email_notifications
    ) VALUES (
      NEW.id,
      'student_group',
      COALESCE(NEW.raw_user_meta_data->>'full_name',
               NEW.raw_user_meta_data->>'name',
               split_part(NEW.email, '@', 1)),
      NEW.email,
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'sub',
      false,
      true
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- handle_new_user is a trigger function only; it must not be invokable as an RPC.
-- Triggers fire regardless of EXECUTE grants, so revoking is safe.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
