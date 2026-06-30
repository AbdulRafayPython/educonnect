-- v2.x: Prompt Quest (the "Prompt Arena") — a game-style, non-MCQ challenge that
-- tests a student's ability to write a good prompt using the Week-2 5-INGREDIENT
-- recipe (WHO / WHAT / DETAILS / OUTPUT / STYLE).
--
-- Flow: a learner gets a UNIQUE scenario per round (no two learners in the same
-- cohort share a scenario in the same round), writes a prompt, and an AI judge
-- (the `grade_prompt` Edge Function, Gemini) scores it 0-2 per ingredient → /10.
-- Three gated rounds — easy → medium → hard — must be cleared in order. Points
-- fold into the existing masterclass_leaderboard() so they climb the same board.
--
-- All writes go through SECURITY DEFINER RPCs or the service-role Edge Function;
-- students have NO direct INSERT/UPDATE on arena tables, so a learner can never
-- set their own score or peek at another's scenario.

-- ── Tables ───────────────────────────────────────────────────────────────────

-- The scenario pool. Each row is one "mission brief" tied to a difficulty round.
CREATE TABLE IF NOT EXISTS public.arena_topics (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,          -- stable key so seeds are re-runnable
  round      text NOT NULL CHECK (round IN ('easy','medium','hard')),
  scenario   text NOT NULL,                 -- the brief shown to the learner
  audience   text,                          -- flavour persona ("You're a parent…")
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One attempt row per (learner, round). Holds the claimed topic, the prompt, and
-- the AI grade. UNIQUE(user_id, round) → single submission per round.
CREATE TABLE IF NOT EXISTS public.arena_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cohort_id    uuid REFERENCES public.cohorts(id) ON DELETE SET NULL,
  round        text NOT NULL CHECK (round IN ('easy','medium','hard')),
  topic_id     uuid NOT NULL REFERENCES public.arena_topics(id),
  prompt_text  text,
  status       text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','submitted','graded')),
  score        numeric(4,1),                -- 0..10 (sum of the five 0-2 sub-scores)
  breakdown    jsonb,                       -- { who, what, details, output, style } each 0..2
  feedback     text,
  strengths    text,
  fixes        text,
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  graded_at    timestamptz,
  UNIQUE (user_id, round)
);

CREATE INDEX IF NOT EXISTS arena_attempts_user_idx   ON public.arena_attempts (user_id);
CREATE INDEX IF NOT EXISTS arena_attempts_cohort_idx ON public.arena_attempts (cohort_id, round);

-- The "no two learners in a cohort get the same scenario per round" guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS arena_unique_topic_per_cohort_round
  ON public.arena_attempts (cohort_id, round, topic_id)
  WHERE cohort_id IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.arena_topics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arena_attempts ENABLE ROW LEVEL SECURITY;

-- topics: teacher full CRUD; learners do NOT read the pool directly (they receive
-- their scenario only via the claim RPC), keeping unseen scenarios secret.
CREATE POLICY "Teacher full arena_topics" ON public.arena_topics
  FOR ALL TO authenticated
  USING (public.is_teacher(auth.uid())) WITH CHECK (public.is_teacher(auth.uid()));

-- attempts: teacher full CRUD (results dashboard); learner SELECT own only.
-- No learner INSERT/UPDATE — claim_arena_topic() and grade_prompt own all writes.
CREATE POLICY "Teacher full arena_attempts" ON public.arena_attempts
  FOR ALL TO authenticated
  USING (public.is_teacher(auth.uid())) WITH CHECK (public.is_teacher(auth.uid()));
CREATE POLICY "Learner read own arena_attempts" ON public.arena_attempts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── RPCs ─────────────────────────────────────────────────────────────────────

-- Whole-board state for the calling learner: the three rounds with lock state and
-- (for unlocked rounds) any attempt + its scenario/grade. Scenarios for locked
-- rounds are withheld so learners can't peek ahead.
CREATE OR REPLACE FUNCTION public.arena_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_cohort uuid;
  rounds   text[] := ARRAY['easy','medium','hard'];
  rname    text;
  prev_unlocked boolean := true;  -- easy is always unlocked
  unlocked boolean;
  arr      jsonb := '[]'::jsonb;
  total    numeric := 0;
  r_id uuid; r_status text; r_score numeric; r_breakdown jsonb; r_feedback text;
  r_strengths text; r_fixes text; r_prompt text; r_topic uuid;
  r_scenario text; r_audience text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT cohort_id INTO v_cohort FROM public.profiles WHERE id = v_uid;

  FOREACH rname IN ARRAY rounds LOOP
    r_id := NULL; r_status := NULL; r_score := NULL; r_breakdown := NULL;
    r_feedback := NULL; r_strengths := NULL; r_fixes := NULL; r_prompt := NULL;
    r_topic := NULL; r_scenario := NULL; r_audience := NULL;

    SELECT id, status, score, breakdown, feedback, strengths, fixes, prompt_text, topic_id
      INTO r_id, r_status, r_score, r_breakdown, r_feedback, r_strengths, r_fixes, r_prompt, r_topic
      FROM public.arena_attempts
      WHERE user_id = v_uid AND round = rname;

    IF r_topic IS NOT NULL THEN
      SELECT scenario, audience INTO r_scenario, r_audience FROM public.arena_topics WHERE id = r_topic;
      total := total + COALESCE(r_score, 0);
    END IF;

    unlocked := prev_unlocked;

    arr := arr || jsonb_build_array(jsonb_build_object(
      'round',      rname,
      'unlocked',   unlocked,
      'attempt_id', r_id,
      'status',     r_status,
      'score',      r_score,
      'breakdown',  r_breakdown,
      'feedback',   r_feedback,
      'strengths',  r_strengths,
      'fixes',      r_fixes,
      'prompt_text', r_prompt,
      'scenario',   CASE WHEN unlocked THEN r_scenario ELSE NULL END,
      'audience',   CASE WHEN unlocked THEN r_audience ELSE NULL END
    ));

    prev_unlocked := (COALESCE(r_status, '') = 'graded');
  END LOOP;

  RETURN jsonb_build_object(
    'has_cohort',  v_cohort IS NOT NULL,
    'cohort_id',   v_cohort,
    'rounds',      arr,
    'total_score', total,
    'max_score',   30
  );
END;
$$;

-- Claim (or resume) the scenario for a round. Serialized per cohort+round with an
-- advisory lock so concurrent claims never collide; picks a random active topic
-- nobody in the cohort has taken for that round. Enforces the easy→medium→hard
-- gate (previous round must be GRADED).
CREATE OR REPLACE FUNCTION public.claim_arena_topic(p_round text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_cohort     uuid;
  v_prev_round text;
  v_prev_status text;
  v_attempt_id uuid;
  v_topic_id   uuid;
  v_scenario   text;
  v_audience   text;
  v_status     text;
  v_prompt     text;
  v_score      numeric;
  v_breakdown  jsonb;
  v_feedback   text;
  v_strengths  text;
  v_fixes      text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_round NOT IN ('easy','medium','hard') THEN RAISE EXCEPTION 'Invalid round'; END IF;

  SELECT cohort_id INTO v_cohort FROM public.profiles WHERE id = v_uid;
  IF v_cohort IS NULL THEN RAISE EXCEPTION 'Join a cohort first (finish onboarding).'; END IF;

  -- Gate: the previous round must be graded.
  IF p_round = 'medium' THEN v_prev_round := 'easy';
  ELSIF p_round = 'hard' THEN v_prev_round := 'medium';
  END IF;
  IF v_prev_round IS NOT NULL THEN
    SELECT status INTO v_prev_status FROM public.arena_attempts WHERE user_id = v_uid AND round = v_prev_round;
    IF COALESCE(v_prev_status, '') <> 'graded' THEN
      RAISE EXCEPTION 'Finish the % round first.', v_prev_round;
    END IF;
  END IF;

  -- Resume an existing attempt for this round (idempotent).
  SELECT a.topic_id, a.id, a.status, a.prompt_text, a.score, a.breakdown, a.feedback, a.strengths, a.fixes,
         t.scenario, t.audience
    INTO v_topic_id, v_attempt_id, v_status, v_prompt, v_score, v_breakdown, v_feedback, v_strengths, v_fixes,
         v_scenario, v_audience
    FROM public.arena_attempts a
    JOIN public.arena_topics t ON t.id = a.topic_id
    WHERE a.user_id = v_uid AND a.round = p_round;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'attempt_id', v_attempt_id, 'round', p_round, 'status', v_status,
      'scenario', v_scenario, 'audience', v_audience, 'prompt_text', v_prompt,
      'score', v_score, 'breakdown', v_breakdown, 'feedback', v_feedback,
      'strengths', v_strengths, 'fixes', v_fixes
    );
  END IF;

  -- Serialize concurrent claims within this cohort+round.
  PERFORM pg_advisory_xact_lock(hashtext(v_cohort::text || ':' || p_round));

  SELECT t.id, t.scenario, t.audience
    INTO v_topic_id, v_scenario, v_audience
    FROM public.arena_topics t
    WHERE t.round = p_round AND t.is_active
      AND NOT EXISTS (
        SELECT 1 FROM public.arena_attempts a
        WHERE a.cohort_id = v_cohort AND a.round = p_round AND a.topic_id = t.id
      )
    ORDER BY random()
    LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No unique scenarios left for this round — ask your teacher to add more.';
  END IF;

  INSERT INTO public.arena_attempts (user_id, cohort_id, round, topic_id, status)
  VALUES (v_uid, v_cohort, p_round, v_topic_id, 'assigned')
  RETURNING id INTO v_attempt_id;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt_id, 'round', p_round, 'status', 'assigned',
    'scenario', v_scenario, 'audience', v_audience, 'prompt_text', NULL,
    'score', NULL, 'breakdown', NULL, 'feedback', NULL, 'strengths', NULL, 'fixes', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.arena_state()                FROM public, anon;
REVOKE ALL ON FUNCTION public.claim_arena_topic(text)      FROM public, anon;
GRANT EXECUTE ON FUNCTION public.arena_state()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_arena_topic(text)   TO authenticated;

-- ── Leaderboard: fold arena points into the existing board ───────────────────
-- Same return signature as 20260609000001 so the frontend type is unchanged —
-- arena points just add to total_points / possible_points / completion_percent.

CREATE OR REPLACE FUNCTION public.masterclass_leaderboard(p_cohort_id uuid DEFAULT NULL)
RETURNS TABLE (
  rank               int,
  user_id            uuid,
  display_name       text,
  avatar_url         text,
  cohort_id          uuid,
  cohort_name        text,
  age_group          text,
  total_points       numeric,
  graded_quizzes     int,
  submitted_quizzes  int,
  possible_points    numeric,
  completion_percent int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH quiz_pts AS (
    SELECT
      q.id,
      q.cohort_ids,
      CASE
        WHEN q.content_type = 'inline' AND q.questions IS NOT NULL
          THEN COALESCE((SELECT SUM((e->>'points')::numeric)
                           FROM jsonb_array_elements(q.questions) e), 0)
        ELSE COALESCE(q.max_score, 0)
      END AS pts
    FROM public.masterclass_quizzes q
  ),
  -- Arena: possible points = (#rounds with an active topic) × 10, the same for
  -- every learner. Earned points = sum of graded round scores.
  arena_possible AS (
    SELECT COALESCE(COUNT(DISTINCT round), 0) * 10 AS pts
    FROM public.arena_topics WHERE is_active
  ),
  arena_agg AS (
    SELECT user_id,
           COALESCE(SUM(score) FILTER (WHERE status = 'graded'), 0) AS arena_points
    FROM public.arena_attempts
    GROUP BY user_id
  ),
  stu AS (
    SELECT
      p.id,
      COALESCE(NULLIF(btrim(p.full_name), ''), 'Learner') AS display_name,
      p.avatar_url,
      p.cohort_id,
      p.age_group,
      c.name AS cohort_name
    FROM public.profiles p
    LEFT JOIN public.cohorts c ON c.id = p.cohort_id
    WHERE p.role = 'student_group'
      AND (p_cohort_id IS NULL OR p.cohort_id = p_cohort_id)
  ),
  sub_agg AS (
    SELECT
      sub.user_id,
      COALESCE(SUM(CASE WHEN sub.status = 'graded' THEN sub.score ELSE 0 END), 0) AS total_points,
      COUNT(*) FILTER (WHERE sub.status = 'graded')                               AS graded_quizzes,
      COUNT(*)                                                                    AS submitted_quizzes,
      MAX(sub.graded_at)                                                          AS last_graded
    FROM public.masterclass_submissions sub
    GROUP BY sub.user_id
  ),
  poss AS (
    SELECT s.id AS user_id, COALESCE(SUM(qp.pts), 0) AS possible_points
    FROM stu s
    LEFT JOIN quiz_pts qp ON s.cohort_id = ANY (qp.cohort_ids)
    GROUP BY s.id
  ),
  joined AS (
    SELECT
      s.id AS user_id, s.display_name, s.avatar_url, s.cohort_id, s.cohort_name, s.age_group,
      COALESCE(sa.total_points, 0) + COALESCE(aa.arena_points, 0)         AS total_points,
      COALESCE(sa.graded_quizzes, 0)::int                                 AS graded_quizzes,
      COALESCE(sa.submitted_quizzes, 0)::int                              AS submitted_quizzes,
      COALESCE(po.possible_points, 0) + (SELECT pts FROM arena_possible)  AS possible_points,
      GREATEST(sa.last_graded, ag.last_arena)                             AS last_graded
    FROM stu s
    LEFT JOIN sub_agg sa ON sa.user_id = s.id
    LEFT JOIN poss po    ON po.user_id = s.id
    LEFT JOIN arena_agg aa ON aa.user_id = s.id
    LEFT JOIN (
      SELECT user_id, MAX(graded_at) AS last_arena FROM public.arena_attempts GROUP BY user_id
    ) ag ON ag.user_id = s.id
  )
  SELECT
    RANK() OVER (ORDER BY total_points DESC, graded_quizzes DESC, last_graded ASC NULLS LAST)::int AS rank,
    user_id, display_name, avatar_url, cohort_id, cohort_name, age_group,
    total_points, graded_quizzes, submitted_quizzes, possible_points,
    CASE WHEN possible_points > 0
      THEN LEAST(100, ROUND(total_points / possible_points * 100))::int
      ELSE 0 END AS completion_percent
  FROM joined
  ORDER BY rank, display_name;
$$;

REVOKE ALL ON FUNCTION public.masterclass_leaderboard(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.masterclass_leaderboard(uuid) TO authenticated;

-- ── Seed the scenario pool (re-runnable via slug ON CONFLICT) ────────────────

INSERT INTO public.arena_topics (slug, round, scenario, audience) VALUES
  -- Easy: clear, single-audience everyday asks
  ('easy-sky-blue',        'easy',   'Get AI to explain why the sky is blue to a curious 9-year-old.',                 'You''re a parent helping your kid with a "why" question.'),
  ('easy-photosynthesis',  'easy',   'Get AI to explain photosynthesis to a 1st-year student cramming for tomorrow''s exam.', 'You''re the student, short on time.'),
  ('easy-brush-teeth',     'easy',   'Get AI to convince a 6-year-old to brush their teeth every night.',              'You''re a tired parent at bedtime.'),
  ('easy-water-cycle',     'easy',   'Get AI to explain the water cycle to a 10-year-old.',                            'You''re helping with homework.'),
  ('easy-boil-egg',        'easy',   'Get AI to explain how to boil a perfect egg to someone who has never cooked.',   'You''re a complete beginner in the kitchen.'),
  ('easy-gravity-kid',     'easy',   'Get AI to explain gravity to a 7-year-old with a fun comparison.',               'You''re a parent answering a bedtime question.'),
  ('easy-shop-status',     'easy',   'Get AI to write a short WhatsApp status ad for a mobile repair shop.',           'You''re a small shop owner.'),
  ('easy-thank-teacher',   'easy',   'Get AI to write a warm thank-you message to a school teacher.',                  'You''re a student at the end of term.'),
  ('easy-grocery-saving',  'easy',   'Get AI to give one simple, practical tip to save money on groceries.',           'You''re managing a household budget.'),
  ('easy-new-word',        'easy',   'Get AI to teach you one new English word with an easy example sentence.',        'You''re an English learner.'),
  ('easy-plant-care',      'easy',   'Get AI to explain how to keep a small indoor plant alive.',                      'You''re a first-time plant owner.'),
  ('easy-bedtime-story',   'easy',   'Get AI to tell a 2-minute bedtime story about a brave little cat.',              'You''re a parent reading to a toddler.'),
  ('easy-make-tea',        'easy',   'Get AI to explain how to make a really good cup of tea.',                        'You''re a beginner.'),
  ('easy-maps-grandparent','easy',   'Get AI to explain how to use Google Maps to a grandparent.',                     'You''re helping an older family member.'),
  ('easy-times-table',     'easy',   'Get AI to explain the 9 times table trick to a 3rd grader.',                     'You''re a parent helping with maths.'),
  ('easy-morning-stretch', 'easy',   'Get AI to suggest a 5-minute morning stretch routine for a total beginner.',     'You''ve never exercised before.'),
  ('easy-picky-eater',     'easy',   'Get AI to convince a picky 8-year-old to try eating vegetables.',                'You''re a parent at dinner.'),
  ('easy-recycle-kid',     'easy',   'Get AI to explain why recycling matters, to a 6-year-old.',                      'You''re a parent or teacher.'),

  -- Medium: multiple constraints; format & details start to matter
  ('med-meal-plan',        'medium', 'Get AI to create a 7-day dinner plan for a family of 5 on a tight weekly budget.', 'You''re managing the home budget.'),
  ('med-interview-prep',   'medium', 'Get AI to help you practise for an entry-level customer-support job interview.',  'You''re a fresh graduate.'),
  ('med-revision-plan',    'medium', 'Get AI to make a 1-week revision plan for a student with 3 exams coming up.',     'You''re the student.'),
  ('med-cv-experience',    'medium', 'Get AI to improve the "Experience" section of a CV for a marketing role with 2 years'' experience.', 'You''re job-hunting.'),
  ('med-quiz-me-biology',  'medium', 'Get AI to quiz you with questions on the human digestive system, one at a time.', 'You''re a student revising.'),
  ('med-bakery-flyer',     'medium', 'Get AI to write a small flyer for a home bakery''s weekend offer.',              'You run a tiny home business.'),
  ('med-leave-email',      'medium', 'Get AI to write a polite email to a manager requesting two days of leave.',      'You''re an employee.'),
  ('med-home-budget',      'medium', 'Get AI to explain how to start a simple monthly home budget from scratch.',      'You''ve never budgeted before.'),
  ('med-science-project',  'medium', 'Get AI to plan a simple, safe science experiment for a 10-year-old''s school project.', 'You''re a parent helping out.'),
  ('med-english-convo',    'medium', 'Get AI to run a short everyday English conversation for a beginner, with gentle corrections.', 'You''re an English learner.'),
  ('med-home-workout',     'medium', 'Get AI to create a 3-day-a-week home workout plan for a busy beginner, no equipment.', 'You''re short on time and gear.'),
  ('med-budget-trip',      'medium', 'Get AI to plan a low-budget 2-day trip to a nearby city for a small family.',    'You''re planning a weekend away.'),
  ('med-complaint',        'medium', 'Get AI to write a firm but polite complaint to a mobile network about poor service.', 'You''re an unhappy customer.'),
  ('med-leftovers',        'medium', 'Get AI to suggest dinner ideas using only rice, eggs and tomatoes.',            'You''re cooking with what''s in the kitchen.'),
  ('med-resume-summary',   'medium', 'Get AI to write a 3-line professional summary for a fresh graduate''s resume.',  'You''re writing your first CV.'),
  ('med-teach-fractions',  'medium', 'Get AI to act as a tutor and teach fractions to a struggling 5th grader.',       'You''re helping your child.'),
  ('med-event-post',       'medium', 'Get AI to write a social-media post inviting people to a charity bake sale.',     'You''re organising the event.'),
  ('med-daily-schedule',   'medium', 'Get AI to make a daily schedule for a student balancing school and chores.',     'You''re the student.'),

  -- Hard: rich, multi-constraint, role + format + tone + iteration all matter
  ('hard-tea-stall',       'hard',   'Get AI to give a step-by-step plan to start a small tea stall with Rs. 20,000.', 'You''re a first-time entrepreneur.'),
  ('hard-mock-interview',  'hard',   'Get AI to run a full mock HR interview: ask 5 questions one at a time and give improvement feedback after each.', 'You''re preparing for a real interview.'),
  ('hard-client-proposal', 'hard',   'Get AI to write a freelance proposal to a new client for a logo-design project.', 'You''re a freelancer pitching work.'),
  ('hard-teach-coding',    'hard',   'Get AI to teach a 12-year-old what "code" is, step by step, checking understanding along the way.', 'You''re a parent or mentor.'),
  ('hard-essay-feedback',  'hard',   'Get AI to give detailed feedback to improve a school essay''s structure and clarity.', 'You''re a student improving a draft.'),
  ('hard-salary-talk',     'hard',   'Get AI to prepare talking points to negotiate a first salary politely but confidently.', 'You''re a new employee.'),
  ('hard-debate-prep',     'hard',   'Get AI to prepare both sides of a school debate on "should students use AI?".',  'You''re a student debater.'),
  ('hard-bakery-campaign', 'hard',   'Get AI to plan a one-week social-media plan for a new home bakery.',             'You run a small business.'),
  ('hard-self-study',      'hard',   'Get AI to break Newton''s laws of motion into a 20-minute self-study lesson.',   'You''re studying alone.'),
  ('hard-wedding-menu',    'hard',   'Get AI to plan a simple low-budget wedding menu for 50 guests.',                 'You''re planning a family event.'),
  ('hard-angry-customer',  'hard',   'Get AI to write a polite phone script for calming and helping an angry customer.', 'You''re a support agent.'),
  ('hard-grammar-tutor',   'hard',   'Get AI to act as an English tutor and explain past simple vs present perfect with practice.', 'You''re an English learner.'),
  ('hard-presentation',    'hard',   'Get AI to help structure and rehearse a 5-minute class project presentation.',   'You''re a nervous student.'),
  ('hard-side-income',     'hard',   'Get AI to suggest a realistic plan to earn a small side income using one skill you have.', 'You''re an adult learner.'),
  ('hard-teen-routine',    'hard',   'Get AI to design a balanced daily routine (sleep, food, study) for a teenager.', 'You''re a parent or the teen.'),
  ('hard-story-coach',     'hard',   'Get AI to coach you to write a short story, asking guiding questions before writing.', 'You''re an aspiring writer.'),
  ('hard-exam-strategy',   'hard',   'Get AI to create a strategy to attempt a 3-hour exam, with time-per-section advice.', 'You''re a student.'),
  ('hard-recipe-scale',    'hard',   'Get AI to convert a curry recipe that serves 4 into one that feeds 12, adjusting quantities.', 'You''re cooking for a big gathering.')
ON CONFLICT (slug) DO NOTHING;
