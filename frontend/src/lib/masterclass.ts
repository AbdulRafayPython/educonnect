// Shared Mode B (AI Masterclass Hub) helpers: cohort metadata, the 12-week
// curriculum template, the 10-minute join gate, and the bulk schedule builder.
import { supabase } from './supabase';

export type AgeGroup = 'little_ones' | 'juniors' | 'advanced';

export interface Cohort {
  id: string;
  name: string;
  age_group: AgeGroup;
  is_active: boolean;
  start_date: string | null;
  created_at: string;
}

export interface ToolItem { name: string; url: string }

export interface MasterclassSession {
  id: string;
  week_number: number;
  title: string;
  session_type: 'class' | 'quiz_session' | 'demo_day' | 'office_hours';
  scheduled_at: string;
  duration_min: number;
  meeting_link: string;
  cohort_ids: string[];
  agenda_md: string | null;
  activity_little_ones: string | null;
  activity_juniors: string | null;
  activity_advanced: string | null;
  tools_needed: ToolItem[] | null;
  recording_url: string | null;
  summary_md: string | null;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  created_at: string;
}

export const cohortMeta: Record<AgeGroup, { label: string; short: string; color: string; badge: string }> = {
  little_ones: { label: 'Little Explorers', short: 'Little Ones (5–10)', color: '#A78BFA', badge: 'bg-[#A78BFA]/15 text-[#6D28D9]' },
  juniors:     { label: 'Junior Builders',  short: 'Juniors (11–15)',  color: '#34D399', badge: 'bg-[#34D399]/15 text-[#047857]' },
  advanced:    { label: 'AI Architects',    short: 'Advanced (16+)',   color: '#F97316', badge: 'bg-[#F97316]/15 text-[#C2410C]' },
};

export const sessionStatusBadge: Record<string, string> = {
  scheduled: 'bg-primary/10 text-primary',
  live: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-error-container text-on-error-container',
};

export const sessionTypeLabel: Record<string, string> = {
  class: 'Class',
  quiz_session: 'Quiz session',
  demo_day: 'Demo day',
  office_hours: 'Office hours',
};

// 12-week "Zero to Hero AI Sessions" curriculum (PRD §7.1).
// One shared, mixed-age class per week (low floor, high ceiling). Each week maps
// to a banner in /public (week-01.webp … week-12.webp) by its `week` number.
export interface CurriculumWeek {
  week: number;
  title: string;
  phase: string;
  skill: string; // the headline takeaway for the week
  session_type: MasterclassSession['session_type'];
  banner: string; // /week-XX.webp
}

// Public path to a week's banner, derived from its number so DB-stored sessions
// (which don't carry a banner) can still render the right art via week_number.
export function weekBanner(week: number): string {
  return `/week-${String(week).padStart(2, '0')}.webp`;
}

// Course hero used on the masterclass hub + Join page.
export const masterclassHeroBanner = '/masterclass-hero.webp';

export const curriculum: CurriculumWeek[] = [
  // Phase 1 — Foundations (weeks 1–2)
  { week: 1,  phase: 'Foundations',   skill: 'Awareness',                   title: 'AI is already around you',            session_type: 'class',    banner: weekBanner(1) },
  { week: 2,  phase: 'Foundations',   skill: 'Asking better questions',     title: 'Prompting basics: talking to AI',     session_type: 'class',    banner: weekBanner(2) },
  // Phase 2 — Everyday AI (weeks 3–6)
  { week: 3,  phase: 'Everyday AI',   skill: 'Learning support',            title: 'AI for study & learning',             session_type: 'class',    banner: weekBanner(3) },
  { week: 4,  phase: 'Everyday AI',   skill: 'Communication',               title: 'AI for English & communication',      session_type: 'class',    banner: weekBanner(4) },
  { week: 5,  phase: 'Everyday AI',   skill: 'Daily-life planning',         title: 'AI for home & daily life',            session_type: 'class',    banner: weekBanner(5) },
  { week: 6,  phase: 'Everyday AI',   skill: 'Creative output',             title: 'AI for creativity',                   session_type: 'class',    banner: weekBanner(6) },
  // Phase 3 — Responsible AI (weeks 7–8)
  { week: 7,  phase: 'Responsible AI', skill: 'Critical thinking',          title: 'AI truth check: spotting mistakes',   session_type: 'class',    banner: weekBanner(7) },
  { week: 8,  phase: 'Responsible AI', skill: 'Responsible use',            title: 'AI safety, privacy & ethics',         session_type: 'class',    banner: weekBanner(8) },
  // Phase 4 — Tools & Future (weeks 9–12)
  { week: 9,  phase: 'Tools & Future', skill: 'Tool selection',             title: 'AI tools beyond ChatGPT',             session_type: 'class',    banner: weekBanner(9) },
  { week: 10, phase: 'Tools & Future', skill: 'Practical earning awareness', title: 'AI for skills & earning',            session_type: 'class',    banner: weekBanner(10) },
  { week: 11, phase: 'Tools & Future', skill: 'Latest AI understanding',    title: 'AI agents & the latest AI era',       session_type: 'class',    banner: weekBanner(11) },
  { week: 12, phase: 'Tools & Future', skill: 'Project presentation',       title: 'Final showcase: your AI project',     session_type: 'demo_day', banner: weekBanner(12) },
];

// ── Quizzes (PRD §7.4) ───────────────────────────────────────────────────────
export type QuizType = 'knowledge_check' | 'hands_on_challenge' | 'reflection';

export const quizTypeMeta: Record<QuizType, { label: string; badge: string }> = {
  knowledge_check:   { label: 'Knowledge check',   badge: 'bg-primary/10 text-primary' },
  hands_on_challenge:{ label: 'Hands-on challenge', badge: 'bg-amber-100 text-amber-700' },
  reflection:        { label: 'Reflection',        badge: 'bg-secondary/10 text-secondary' },
};

// Inline question shapes. MCQ is auto-scorable; short answer is graded by hand.
export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'short';
  question: string;
  options?: string[];   // mcq only
  correct?: number;     // mcq only — index into options
  points: number;
}

export interface MasterclassQuiz {
  id: string;
  week_number: number;
  title: string;
  description: string | null;
  quiz_type: QuizType;
  cohort_ids: string[];
  due_date: string;
  content_type: 'inline' | 'file';
  questions: QuizQuestion[] | null;
  file_path: string | null;
  max_score: number;
  created_by: string | null;
  created_at: string;
}

export interface MasterclassSubmission {
  id: string;
  quiz_id: string;
  user_id: string;
  answers: { question_id: string; answer: string | number }[] | null;
  file_path: string | null;
  submitted_at: string;
  score: number | null;
  feedback: string | null;
  graded_at: string | null;
  graded_by: string | null;
  status: 'submitted' | 'graded';
}

export const maxScoreOf = (q: Pick<MasterclassQuiz, 'content_type' | 'questions' | 'max_score'>): number =>
  q.content_type === 'inline' && q.questions
    ? q.questions.reduce((sum, qq) => sum + (qq.points || 0), 0)
    : q.max_score;

// Auto-score only the MCQ portion of an inline submission; short answers stay
// for the teacher to grade. Returns the points earned on auto-gradable items.
export function autoScoreMcq(questions: QuizQuestion[], answers: { question_id: string; answer: string | number }[]): number {
  let earned = 0;
  for (const q of questions) {
    if (q.type !== 'mcq') continue;
    const a = answers.find((x) => x.question_id === q.id);
    if (a && Number(a.answer) === q.correct) earned += q.points || 0;
  }
  return earned;
}

// Record that the current student joined a session (idempotent per the
// UNIQUE(session_id,user_id) constraint). Best-effort — fired on Join click so
// the progress page's "sessions attended" reflects reality.
export async function recordAttendance(sessionId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('masterclass_attendance')
    .upsert({ session_id: sessionId, user_id: user.id, joined_at: new Date().toISOString() }, { onConflict: 'session_id,user_id' });
}

// Parse a newline-separated list of links (e.g. recording URLs) where each line
// is either a bare "https://…" or an optionally-labelled "Part 1, https://…".
// Backward-compatible with a single bare URL. Bare URLs that contain commas
// (query params) are preserved because the label split requires ", http".
export function parseSessionLinks(text: string | null | undefined): { label: string; url: string }[] {
  if (!text) return [];
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?),\s*(https?:\/\/.+)$/);
      if (m) return { label: m[1].trim(), url: m[2].trim() };
      return { label: '', url: line };
    });
}

// FR-MC-05: the "Join class" button activates 10 minutes before start.
export const isJoinableMC = (scheduledAt: string, durationMin: number): boolean => {
  const start = new Date(scheduledAt).getTime();
  const end = start + durationMin * 60_000;
  const now = Date.now();
  return now >= start - 10 * 60_000 && now <= end;
};

// ── Leaderboard (AI Masterclass) ─────────────────────────────────────────────
// One safe row per learner, returned by the masterclass_leaderboard() RPC.
// Points come only from *graded* submissions; pending ones count as activity.
export interface LeaderboardRow {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  cohort_id: string | null;
  cohort_name: string | null;
  age_group: AgeGroup | null;
  total_points: number;
  graded_quizzes: number;
  submitted_quizzes: number;
  possible_points: number;
  completion_percent: number;
}

// XP tiers for the gaming feel — derived purely from earned points so the badge
// is stable regardless of cohort size. Thresholds are deliberately gentle.
export interface Tier { name: string; min: number; color: string; badge: string }
export const tiers: Tier[] = [
  { name: 'Platinum', min: 80, color: '#22D3EE', badge: 'bg-[#22D3EE]/15 text-[#0E7490]' },
  { name: 'Gold',     min: 50, color: '#F59E0B', badge: 'bg-[#F59E0B]/15 text-[#B45309]' },
  { name: 'Silver',   min: 25, color: '#94A3B8', badge: 'bg-[#94A3B8]/20 text-[#475569]' },
  { name: 'Bronze',   min: 0,  color: '#D97706', badge: 'bg-[#D97706]/15 text-[#92400E]' },
];
export const tierOf = (points: number): Tier =>
  tiers.find((t) => points >= t.min) ?? tiers[tiers.length - 1];

// Fetch the leaderboard. Pass a cohort id to scope server-side, else all Mode B
// learners are returned (filter by age group client-side for the tab bar).
export async function fetchLeaderboard(cohortId?: string): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc('masterclass_leaderboard', {
    p_cohort_id: cohortId ?? null,
  });
  if (error) throw error;
  return (data as LeaderboardRow[]) ?? [];
}

// ── Homework (Google-Classroom-style assignments, PRD §7.x) ──────────────────
export interface MasterclassHomework {
  id: string;
  week_number: number | null;
  title: string;
  instructions_md: string;
  cohort_ids: string[];
  due_date: string | null;
  points: number | null;          // null = review-only (no score)
  attachment_path: string | null; // teacher file in masterclass-materials
  created_by: string | null;
  created_at: string;
}

export interface HomeworkSubmission {
  id: string;
  homework_id: string;
  user_id: string;
  text: string | null;
  file_path: string | null;       // masterclass-submissions/<uid>/...
  submitted_at: string;
  status: 'submitted' | 'graded' | 'returned';
  score: number | null;
  feedback: string | null;
  graded_at: string | null;
  graded_by: string | null;
}

export type HomeworkStatus = 'assigned' | 'submitted' | 'graded';

export const homeworkStatusBadge: Record<HomeworkStatus, string> = {
  assigned: 'bg-amber-100 text-amber-700',
  submitted: 'bg-primary/10 text-primary',
  graded: 'bg-emerald-50 text-emerald-600',
};

// A student's status for a homework, from their submission (if any). Both
// 'graded' and 'returned' submissions read as "graded" (reviewed by teacher).
export const homeworkStatusOf = (sub?: HomeworkSubmission | null): HomeworkStatus =>
  !sub ? 'assigned' : sub.status === 'submitted' ? 'submitted' : 'graded';

// Past-due helper for the "Late" hint (only meaningful before submitting).
export const isHomeworkOverdue = (dueDate: string | null): boolean =>
  !!dueDate && new Date(dueDate).getTime() < Date.now();

export interface GeneratedSession {
  week_number: number;
  title: string;
  session_type: MasterclassSession['session_type'];
  scheduled_at: string;
  duration_min: number;
  meeting_link: string;
  cohort_ids: string[];
  status: 'scheduled';
}

/**
 * Build 12 weekly session payloads from a first-session datetime-local string.
 * Each week is the same weekday/time, +7 days. Titles come from the curriculum.
 */
export function buildSchedule(
  firstLocalDateTime: string,
  meetingLink: string,
  cohortIds: string[],
  durationMin = 120,
): GeneratedSession[] {
  const first = new Date(firstLocalDateTime);
  return curriculum.map((c, i) => {
    const d = new Date(first);
    d.setDate(d.getDate() + i * 7);
    return {
      week_number: c.week,
      title: c.title,
      session_type: c.session_type,
      scheduled_at: d.toISOString(),
      duration_min: durationMin,
      meeting_link: meetingLink,
      cohort_ids: cohortIds,
      status: 'scheduled' as const,
    };
  });
}
