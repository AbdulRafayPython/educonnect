import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import CohortChip from '../components/CohortChip';
import { teacherMasterclassNav } from '../lib/nav';
import { supabase } from '../lib/supabase';
import {
  ARENA_INGREDIENTS, ARENA_ROUNDS, cohortMeta,
  type AgeGroup, type ArenaBreakdown, type ArenaRound,
} from '../lib/masterclass';

interface AttemptRow {
  id: string;
  user_id: string;
  cohort_id: string | null;
  round: ArenaRound;
  status: 'assigned' | 'submitted' | 'graded';
  score: number | null;
  breakdown: ArenaBreakdown | null;
  prompt_text: string | null;
  feedback: string | null;
  profiles: { full_name: string | null; avatar_url: string | null; age_group: AgeGroup | null } | null;
  arena_topics: { scenario: string | null } | null;
}

interface StudentRow {
  user_id: string;
  name: string;
  avatar: string | null;
  age_group: AgeGroup | null;
  byRound: Partial<Record<ArenaRound, AttemptRow>>;
  total: number;
  graded: number;
}

type Filter = 'all' | AgeGroup;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All Cohorts' },
  { key: 'little_ones', label: cohortMeta.little_ones.label },
  { key: 'juniors', label: cohortMeta.juniors.label },
  { key: 'advanced', label: cohortMeta.advanced.label },
];

function Avatar({ name, url, size = 34 }: { name: string; url: string | null; size?: number }) {
  const initials = (name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return url ? (
    <img src={url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full academic-gradient flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials}</div>
  );
}

function ScoreChip({ a }: { a?: AttemptRow }) {
  if (!a) return <span className="text-on-surface-variant/40 text-sm">—</span>;
  if (a.status !== 'graded') return <span className="text-[0.6rem] font-bold uppercase tracking-wide text-amber-600">pending</span>;
  const score = a.score ?? 0;
  const color = score >= 7 ? '#22C55E' : score >= 5 ? '#F59E0B' : '#EF4444';
  return <span className="inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-extrabold tabular-nums" style={{ background: `${color}1f`, color }}>{score}/10</span>;
}

export default function TeacherMasterclassArena() {
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [pool, setPool] = useState<Record<ArenaRound, number>>({ easy: 0, medium: 0, hard: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: attempts }, { data: topics }] = await Promise.all([
        supabase
          .from('arena_attempts')
          .select('id, user_id, cohort_id, round, status, score, breakdown, prompt_text, feedback, profiles(full_name, avatar_url, age_group), arena_topics(scenario)')
          .order('graded_at', { ascending: false }),
        supabase.from('arena_topics').select('round').eq('is_active', true),
      ]);
      setRows((attempts as unknown as AttemptRow[]) ?? []);
      const p: Record<ArenaRound, number> = { easy: 0, medium: 0, hard: 0 };
      (topics ?? []).forEach((t: { round: ArenaRound }) => { p[t.round] = (p[t.round] ?? 0) + 1; });
      setPool(p);
      setLoading(false);
    })();
  }, []);

  const students = useMemo<StudentRow[]>(() => {
    const map = new Map<string, StudentRow>();
    for (const a of rows) {
      let s = map.get(a.user_id);
      if (!s) {
        s = {
          user_id: a.user_id,
          name: a.profiles?.full_name?.trim() || 'Learner',
          avatar: a.profiles?.avatar_url ?? null,
          age_group: a.profiles?.age_group ?? null,
          byRound: {}, total: 0, graded: 0,
        };
        map.set(a.user_id, s);
      }
      s.byRound[a.round] = a;
      if (a.status === 'graded') { s.total += a.score ?? 0; s.graded += 1; }
    }
    return Array.from(map.values()).sort((x, y) => y.total - x.total);
  }, [rows]);

  const visible = filter === 'all' ? students : students.filter((s) => s.age_group === filter);

  const gradedAttempts = rows.filter((r) => r.status === 'graded');
  const avg = gradedAttempts.length ? (gradedAttempts.reduce((s, r) => s + (r.score ?? 0), 0) / gradedAttempts.length) : 0;

  return (
    <DashboardLayout title="Prompt Quest" navItems={teacherMasterclassNav}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-extrabold text-primary tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: '1.7rem' }}>stadia_controller</span>Prompt Quest — Results
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Learners write prompts for unique scenarios; an AI judge scores each on the 5-ingredient recipe. Points feed the{' '}
            <Link to="/teacher/masterclass/leaderboard" className="text-primary font-bold hover:underline">leaderboard</Link>.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Learners played', value: students.length, icon: 'group' },
            { label: 'Rounds graded', value: gradedAttempts.length, icon: 'task_alt' },
            { label: 'Average score', value: `${avg.toFixed(1)}/10`, icon: 'trending_up' },
            { label: 'Scenarios in pool', value: pool.easy + pool.medium + pool.hard, icon: 'inventory_2' },
          ].map((s) => (
            <div key={s.label} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '1.3rem' }}>{s.icon}</span>
              <p className="text-xl font-extrabold text-on-surface mt-1">{s.value}</p>
              <p className="text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-bold transition-all ${
                filter === f.key ? 'academic-gradient text-white shadow-sm' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}>{f.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="h-64 rounded-2xl bg-surface-container/40 animate-pulse" />
        ) : visible.length === 0 ? (
          <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-3 block">stadia_controller</span>
            <p className="text-on-surface font-bold">No quest attempts yet</p>
            <p className="text-sm text-on-surface-variant mt-1">Once learners play, their scores show up here.</p>
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container/40">
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-3 py-2.5 hidden sm:table-cell">Cohort</th>
                    {ARENA_ROUNDS.map((r) => <th key={r.key} className="px-3 py-2.5 text-center">{r.label}</th>)}
                    <th className="px-3 py-2.5 text-right">Total</th>
                    <th className="px-2 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => {
                    const open = expanded === s.user_id;
                    return (
                      <>
                        <tr key={s.user_id} className="border-t border-outline-variant/10 hover:bg-surface-container/30 cursor-pointer"
                          onClick={() => setExpanded(open ? null : s.user_id)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={s.name} url={s.avatar} />
                              <span className="font-bold text-on-surface whitespace-nowrap">{s.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 hidden sm:table-cell">
                            <CohortChip ageGroup={s.age_group} size="sm" />
                          </td>
                          {ARENA_ROUNDS.map((r) => <td key={r.key} className="px-3 py-3 text-center"><ScoreChip a={s.byRound[r.key]} /></td>)}
                          <td className="px-3 py-3 text-right font-extrabold text-on-surface tabular-nums">{s.total}<span className="text-on-surface-variant font-bold text-xs">/30</span></td>
                          <td className="px-2 py-3 text-on-surface-variant">
                            <span className="material-symbols-outlined transition-transform" style={{ fontSize: '1.2rem', transform: open ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-surface-container/20">
                            <td colSpan={3 + ARENA_ROUNDS.length} className="px-4 py-4">
                              <div className="space-y-4">
                                {ARENA_ROUNDS.map((r) => {
                                  const a = s.byRound[r.key];
                                  if (!a) return null;
                                  return (
                                    <div key={r.key} className="rounded-xl bg-surface-container-lowest border border-outline-variant/10 p-4">
                                      <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="text-[0.6rem] font-bold uppercase tracking-widest" style={{ color: r.color }}>{r.label} · {r.node}</span>
                                        <ScoreChip a={a} />
                                      </div>
                                      {a.arena_topics?.scenario && <p className="text-xs text-on-surface-variant mb-2"><span className="font-bold text-on-surface">Scenario:</span> {a.arena_topics.scenario}</p>}
                                      {a.prompt_text
                                        ? <p className="text-sm text-on-surface whitespace-pre-wrap bg-surface-variant/30 rounded-lg px-3 py-2">{a.prompt_text}</p>
                                        : <p className="text-xs italic text-on-surface-variant">No prompt submitted yet.</p>}
                                      {a.breakdown && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                          {ARENA_INGREDIENTS.map((ing) => (
                                            <span key={ing.key} className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-[0.6rem] font-bold text-on-surface-variant">
                                              {ing.label} {a.breakdown![ing.key]}/2
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                      {a.feedback && <p className="text-xs text-on-surface-variant italic mt-2">“{a.feedback}”</p>}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
