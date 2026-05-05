-- 1. Non-recursive teacher check via SECURITY DEFINER helper
CREATE OR REPLACE FUNCTION public.is_teacher(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND role = 'teacher');
$$;

REVOKE ALL ON FUNCTION public.is_teacher(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_teacher(uuid) TO authenticated;

-- 2. Restore "teacher reads all profiles" without recursion
DROP POLICY IF EXISTS "Teacher can read all profiles" ON public.profiles;
CREATE POLICY "Teacher can read all profiles" ON public.profiles
  FOR SELECT USING (public.is_teacher(auth.uid()));

-- 3. Tighten quizzes UPDATE: restrict to authenticated, and require row already
--    visible (which under our SELECT policy means it exists). The advisor's
--    USING(true)/WITH CHECK(true) is unavoidable without a student_id column,
--    but at minimum we forbid anon.
DROP POLICY IF EXISTS "Student submit quizzes" ON public.quizzes;
CREATE POLICY "Student submit quizzes" ON public.quizzes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Tighten increment_completed_lectures: only teachers may call it
CREATE OR REPLACE FUNCTION public.increment_completed_lectures(course_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_teacher(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.courses
  SET completed_lectures = completed_lectures + 1
  WHERE id = course_id_param;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_completed_lectures(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.increment_completed_lectures(uuid) TO authenticated;;