-- EduConnect: AI-Masterclass Homework (Google-Classroom-style assignments).
-- Distinct from masterclass_quizzes: homework is instruction-heavy (Markdown
-- brief) with a free-form submission (typed answer and/or file upload), then
-- teacher review + optional grade/feedback. Mirrors the quizzes RLS exactly.

CREATE TABLE IF NOT EXISTS public.masterclass_homework (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number     int,
  title           text NOT NULL,
  instructions_md text NOT NULL,
  cohort_ids      uuid[] DEFAULT '{}',
  due_date        timestamptz,
  points          int,               -- optional max score; NULL = ungraded (review-only)
  attachment_path text,              -- optional teacher file in `masterclass-materials`
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.masterclass_homework_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id  uuid NOT NULL REFERENCES public.masterclass_homework(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text         text,                 -- typed answer
  file_path    text,                 -- file in `masterclass-submissions/<uid>/...`
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','graded','returned')),
  score        numeric(5,2),
  feedback     text,
  graded_at    timestamptz,
  graded_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (homework_id, user_id)
);

CREATE INDEX IF NOT EXISTS masterclass_homework_due_idx ON public.masterclass_homework (due_date);
CREATE INDEX IF NOT EXISTS masterclass_homework_subs_hw_idx ON public.masterclass_homework_submissions (homework_id);

ALTER TABLE public.masterclass_homework             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.masterclass_homework_submissions ENABLE ROW LEVEL SECURITY;

-- homework: teacher full CRUD; student SELECT where their cohort is targeted.
CREATE POLICY "Teacher full mc_homework" ON public.masterclass_homework
  FOR ALL TO authenticated
  USING (public.is_teacher(auth.uid())) WITH CHECK (public.is_teacher(auth.uid()));
CREATE POLICY "Student read cohort mc_homework" ON public.masterclass_homework
  FOR SELECT TO authenticated
  USING (public.current_cohort_id() = ANY (cohort_ids));

-- submissions: teacher full CRUD (grading); student INSERT/SELECT/UPDATE own.
CREATE POLICY "Teacher full mc_hw_submissions" ON public.masterclass_homework_submissions
  FOR ALL TO authenticated
  USING (public.is_teacher(auth.uid())) WITH CHECK (public.is_teacher(auth.uid()));
CREATE POLICY "Student read own mc_hw_submissions" ON public.masterclass_homework_submissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Student insert own mc_hw_submissions" ON public.masterclass_homework_submissions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Student update own mc_hw_submissions" ON public.masterclass_homework_submissions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
