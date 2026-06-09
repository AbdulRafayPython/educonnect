-- v2.0: AI Masterclass Leaderboard.
-- Ranks every Mode B (student_group) learner by total *graded* quiz points.
-- Pending/ungraded submissions count as activity (submitted_quizzes) but earn no
-- points. Possible points mirror the frontend maxScoreOf(): an inline quiz sums
-- its question points, a file quiz uses max_score.
--
-- SECURITY DEFINER so the function can read every learner's profile + submissions
-- (students can't SELECT each other's profiles under RLS — good). It returns ONLY
-- leaderboard-safe fields (no email / private columns).

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
    -- Possible points per quiz (mirrors maxScoreOf in src/lib/masterclass.ts).
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
      COALESCE(sa.total_points, 0)              AS total_points,
      COALESCE(sa.graded_quizzes, 0)::int       AS graded_quizzes,
      COALESCE(sa.submitted_quizzes, 0)::int    AS submitted_quizzes,
      COALESCE(po.possible_points, 0)           AS possible_points,
      sa.last_graded
    FROM stu s
    LEFT JOIN sub_agg sa ON sa.user_id = s.id
    LEFT JOIN poss po    ON po.user_id = s.id
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
