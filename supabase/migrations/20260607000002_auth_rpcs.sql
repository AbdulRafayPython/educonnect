-- v2.0 auth RPCs: Mode B onboarding enrolment + teacher bootstrap.
-- All SECURITY DEFINER because RLS would otherwise block the cross-row reads
-- (a not-yet-enrolled student can't SELECT cohorts; profiles has no INSERT policy).

-- ─────────────────────────────────────────────────────────────────────────────
-- complete_onboarding: enrol the calling student_group user into the active
-- cohort for their age group (find-or-create), set name, flip onboarding_complete.
-- Returns the cohort id. Cannot change role (caller must already be student_group).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_onboarding(p_age_group text, p_full_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_role      text;
  v_cohort_id uuid;
  v_name      text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'student_group' THEN
    RAISE EXCEPTION 'forbidden: only masterclass students onboard';
  END IF;

  IF p_age_group NOT IN ('little_ones','juniors','advanced') THEN
    RAISE EXCEPTION 'invalid age group: %', p_age_group;
  END IF;

  -- Find the active cohort for this age group, or create a default one.
  SELECT id INTO v_cohort_id
    FROM public.cohorts
   WHERE age_group = p_age_group AND is_active = true
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_cohort_id IS NULL THEN
    INSERT INTO public.cohorts (name, age_group, is_active)
    VALUES (
      CASE p_age_group
        WHEN 'little_ones' THEN 'Little Explorers'
        WHEN 'juniors'     THEN 'Junior Builders'
        ELSE 'AI Architects'
      END,
      p_age_group,
      true
    )
    RETURNING id INTO v_cohort_id;
  END IF;

  v_name := NULLIF(btrim(p_full_name), '');

  UPDATE public.profiles
     SET age_group           = p_age_group,
         cohort_id           = v_cohort_id,
         full_name           = COALESCE(v_name, full_name),
         onboarding_complete = true
   WHERE id = v_uid;

  RETURN v_cohort_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- teacher_exists: lets the public /setup page know whether bootstrap is locked.
-- Anon-callable on purpose (returns only a boolean, no data).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.teacher_exists()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher');
$$;

REVOKE ALL ON FUNCTION public.teacher_exists() FROM public;
GRANT EXECUTE ON FUNCTION public.teacher_exists() TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- bootstrap_teacher: one-time, promotes the calling user to teacher ONLY while
-- no teacher exists yet (the DB-level "disabled after first use" lock from
-- FR-AUTH-T-01). Once any teacher row exists this always raises.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bootstrap_teacher(p_full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE role = 'teacher') THEN
    RAISE EXCEPTION 'setup already complete';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO public.profiles (id, role, full_name, email, onboarding_complete, email_notifications)
  VALUES (v_uid, 'teacher', NULLIF(btrim(p_full_name), ''), v_email, true, true)
  ON CONFLICT (id) DO UPDATE
    SET role = 'teacher',
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_teacher(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_teacher(text) TO authenticated;
