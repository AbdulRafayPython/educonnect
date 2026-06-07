-- v2.0 Phase 5: certificate eligibility + issuance.
-- "Complete" = the student has a submission for every quiz targeting their cohort
-- (interpretation of FR-QUIZ-MC-05's "all quizzes for all 12 weeks"); there must
-- be at least one quiz. Both RPCs are SECURITY DEFINER so the cohort-wide counts
-- aren't limited by the caller's row-level visibility.

-- certificate_status: snapshot for the student's progress + certificate page.
CREATE OR REPLACE FUNCTION public.certificate_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_cohort uuid;
  v_qtotal int;
  v_qdone  int;
  v_stotal int;
  v_sdone  int;
  v_issued boolean := false;
  v_pdf    text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT cohort_id INTO v_cohort FROM public.profiles WHERE id = v_uid;

  SELECT count(*) INTO v_qtotal FROM public.masterclass_quizzes q
   WHERE v_cohort = ANY (q.cohort_ids);
  SELECT count(*) INTO v_qdone FROM public.masterclass_submissions s
    JOIN public.masterclass_quizzes q ON q.id = s.quiz_id
   WHERE s.user_id = v_uid AND v_cohort = ANY (q.cohort_ids);
  SELECT count(*) INTO v_stotal FROM public.masterclass_sessions ms
   WHERE v_cohort = ANY (ms.cohort_ids) AND ms.status <> 'cancelled';
  SELECT count(*) INTO v_sdone FROM public.masterclass_attendance a
    JOIN public.masterclass_sessions ms ON ms.id = a.session_id
   WHERE a.user_id = v_uid AND v_cohort = ANY (ms.cohort_ids);

  SELECT true, pdf_path INTO v_issued, v_pdf
    FROM public.certificates WHERE user_id = v_uid AND cohort_id = v_cohort;

  RETURN json_build_object(
    'cohort_id', v_cohort,
    'quizzes_total', COALESCE(v_qtotal, 0),
    'quizzes_completed', COALESCE(v_qdone, 0),
    'sessions_total', COALESCE(v_stotal, 0),
    'sessions_attended', COALESCE(v_sdone, 0),
    'eligible', (COALESCE(v_qtotal, 0) > 0 AND COALESCE(v_qdone, 0) >= COALESCE(v_qtotal, 0)),
    'issued', COALESCE(v_issued, false),
    'pdf_path', v_pdf
  );
END;
$$;

REVOKE ALL ON FUNCTION public.certificate_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.certificate_status() TO authenticated;

-- issue_certificate: re-validate eligibility server-side, upsert the row.
-- The client uploads the generated PDF to certificates/<uid>/… first and passes
-- the path here.
CREATE OR REPLACE FUNCTION public.issue_certificate(p_pdf_path text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_cohort uuid;
  v_qtotal int;
  v_qdone  int;
  v_sdone  int;
  v_id     uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_pdf_path IS NULL OR btrim(p_pdf_path) = '' THEN RAISE EXCEPTION 'pdf path required'; END IF;

  SELECT cohort_id INTO v_cohort FROM public.profiles WHERE id = v_uid;
  IF v_cohort IS NULL THEN RAISE EXCEPTION 'no cohort'; END IF;

  SELECT count(*) INTO v_qtotal FROM public.masterclass_quizzes q
   WHERE v_cohort = ANY (q.cohort_ids);
  SELECT count(*) INTO v_qdone FROM public.masterclass_submissions s
    JOIN public.masterclass_quizzes q ON q.id = s.quiz_id
   WHERE s.user_id = v_uid AND v_cohort = ANY (q.cohort_ids);
  IF v_qtotal = 0 OR v_qdone < v_qtotal THEN
    RAISE EXCEPTION 'not eligible: % of % quizzes complete', v_qdone, v_qtotal;
  END IF;

  SELECT count(*) INTO v_sdone FROM public.masterclass_attendance a
    JOIN public.masterclass_sessions ms ON ms.id = a.session_id
   WHERE a.user_id = v_uid AND v_cohort = ANY (ms.cohort_ids);

  INSERT INTO public.certificates (user_id, cohort_id, pdf_path, sessions_count, quizzes_count)
  VALUES (v_uid, v_cohort, p_pdf_path, v_sdone, v_qdone)
  ON CONFLICT (user_id, cohort_id) DO UPDATE
    SET pdf_path = EXCLUDED.pdf_path,
        sessions_count = EXCLUDED.sessions_count,
        quizzes_count = EXCLUDED.quizzes_count,
        issued_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_certificate(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.issue_certificate(text) TO authenticated;

-- Storage: let a student write their own certificate PDF under certificates/<uid>/.
-- (Read policy already exists from the foundation migration.)
CREATE POLICY "Student write own certificate" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Student update own certificate" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text
  );
