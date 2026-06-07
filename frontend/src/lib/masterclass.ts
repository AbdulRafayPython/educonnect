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

// 12-week "Zero to Hero AI Sessions" curriculum (PRD §7.1): three phases.
export interface CurriculumWeek {
  week: number;
  title: string;
  phase: string;
  session_type: MasterclassSession['session_type'];
}

export const curriculum: CurriculumWeek[] = [
  // Phase 1 — AI Foundations (weeks 1–4)
  { week: 1,  phase: 'AI Foundations', title: 'What is AI? Meet your new superpower', session_type: 'class' },
  { week: 2,  phase: 'AI Foundations', title: 'Talking to AI: prompts that work', session_type: 'class' },
  { week: 3,  phase: 'AI Foundations', title: 'AI tools tour: ChatGPT, Gemini & friends', session_type: 'class' },
  { week: 4,  phase: 'AI Foundations', title: 'Staying safe & smart with AI', session_type: 'class' },
  // Phase 2 — Creating with AI (weeks 5–8)
  { week: 5,  phase: 'Creating with AI', title: 'Make images & art with AI', session_type: 'class' },
  { week: 6,  phase: 'Creating with AI', title: 'Write stories, songs & scripts with AI', session_type: 'class' },
  { week: 7,  phase: 'Creating with AI', title: 'Build a mini website with AI', session_type: 'class' },
  { week: 8,  phase: 'Creating with AI', title: 'AI for school: research & study helpers', session_type: 'class' },
  // Phase 3 — Building Agents (weeks 9–12)
  { week: 9,  phase: 'Building Agents', title: 'What is an AI agent?', session_type: 'class' },
  { week: 10, phase: 'Building Agents', title: 'Automate tasks with Make.com & Zapier', session_type: 'class' },
  { week: 11, phase: 'Building Agents', title: 'Build your first AI assistant', session_type: 'class' },
  { week: 12, phase: 'Building Agents', title: 'Demo day: show your AI project', session_type: 'demo_day' },
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

// FR-MC-05: the "Join class" button activates 10 minutes before start.
export const isJoinableMC = (scheduledAt: string, durationMin: number): boolean => {
  const start = new Date(scheduledAt).getTime();
  const end = start + durationMin * 60_000;
  const now = Date.now();
  return now >= start - 10 * 60_000 && now <= end;
};

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
