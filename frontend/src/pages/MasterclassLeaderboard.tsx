import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import CohortChip from '../components/CohortChip';
import { masterclassNav, teacherMasterclassNav } from '../lib/nav';
import { useAppStore } from '../store/useAppStore';
import { cohortMeta, fetchLeaderboard, tierOf, type AgeGroup, type LeaderboardRow } from '../lib/masterclass';

type Filter = 'all' | AgeGroup;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All Cohorts' },
  { key: 'little_ones', label: cohortMeta.little_ones.label },
  { key: 'juniors', label: cohortMeta.juniors.label },
  { key: 'advanced', label: cohortMeta.advanced.label },
];

const fmtXp = (n: number) => `${Math.round(n).toLocaleString()} XP`;

function Avatar({ row, size = 40 }: { row: LeaderboardRow; size?: number }) {
  const initials = (row.display_name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return row.avatar_url ? (
    <img src={row.avatar_url} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full academic-gradient flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials}</div>
  );
}

// Podium avatar with responsive sizing via classes (so it shrinks on phones and
// the three columns never overflow the card). `big` = the 1st-place medallion.
function PodiumAvatar({ row, big }: { row: LeaderboardRow; big?: boolean }) {
  const initials = (row.display_name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const cls = big ? 'w-14 h-14 sm:w-[4.5rem] sm:h-[4.5rem] text-xl' : 'w-11 h-11 sm:w-14 sm:h-14 text-base';
  return row.avatar_url ? (
    <img src={row.avatar_url} alt="" className={`rounded-full object-cover ${cls}`} />
  ) : (
    <div className={`rounded-full academic-gradient flex items-center justify-center text-white font-bold ${cls}`}>{initials}</div>
  );
}

function TierBadge({ points }: { points: number }) {
  const t = tierOf(points);
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${t.badge}`}>
    <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>military_tech</span>{t.name}
  </span>;
}

// Podium order: 2nd (left), 1st (center, raised), 3rd (right).
function Podium({ rows }: { rows: LeaderboardRow[] }) {
  const [first, second, third] = rows;
  const slots = [
    { row: second, place: 2, h: 'h-20', medal: '#94A3B8', delay: 0.05 },
    { row: first, place: 1, h: 'h-28', medal: '#F59E0B', delay: 0 },
    { row: third, place: 3, h: 'h-16', medal: '#D97706', delay: 0.1 },
  ].filter((s) => s.row);
  return (
    <div className="academic-gradient rounded-3xl px-4 pt-11 pb-4 sm:px-8 sm:pt-14 sm:pb-8 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, white 0, transparent 45%), radial-gradient(circle at 80% 60%, white 0, transparent 40%)' }} />
      <div className="relative flex items-end justify-center gap-1.5 sm:gap-6">
        {slots.map(({ row, place, h, medal, delay }) => (
          <motion.div key={row!.user_id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay, type: 'spring', stiffness: 120, damping: 16 }}
            className="flex flex-col items-center flex-1 min-w-0 max-w-32">
            <div className="relative">
              {place === 1 && <span className="material-symbols-outlined absolute -top-9 sm:-top-10 left-1/2 -translate-x-1/2 text-amber-300" style={{ fontSize: '2.4rem', fontVariationSettings: "'FILL' 1", filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }}>emoji_events</span>}
              <div className="rounded-full p-[3px]" style={{ background: medal }}>
                <PodiumAvatar row={row!} big={place === 1} />
              </div>
              <span className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full text-white text-[0.65rem] sm:text-xs font-bold flex items-center justify-center ring-2 ring-white/90" style={{ background: medal }}>{place}</span>
            </div>
            <p className="mt-2.5 w-full text-center text-white font-bold text-xs sm:text-sm truncate">{row!.display_name}</p>
            <CohortChip ageGroup={row!.age_group} size="sm" className="mt-1 max-w-full" />
            <p className="text-white/90 font-extrabold text-sm sm:text-base mt-1">{fmtXp(row!.total_points)}</p>
            <div className={`mt-2 w-full ${h} rounded-t-xl bg-white/15 backdrop-blur-sm flex items-start justify-center pt-2`}>
              <span className="text-white/70 font-black text-lg">{place}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function MyRankCard({ row, total }: { row: LeaderboardRow; total: number }) {
  const t = tierOf(row.total_points);
  const ahead = total > 1 ? Math.round(((total - row.rank) / (total - 1)) * 100) : 100;
  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Your Rank</h3>
        <span className="text-2xl font-extrabold text-primary">#{row.rank}</span>
      </div>
      <div className="flex items-center gap-3">
        <Avatar row={row} size={48} />
        <div className="min-w-0">
          <p className="font-bold text-on-surface truncate">{row.display_name}</p>
          <CohortChip ageGroup={row.age_group} className="mt-0.5" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="rounded-xl bg-surface-container/50 p-3">
          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant">Points</p>
          <p className="text-lg font-extrabold text-on-surface">{fmtXp(row.total_points)}</p>
        </div>
        <div className="rounded-xl bg-surface-container/50 p-3">
          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant">Tier</p>
          <p className="text-lg font-extrabold" style={{ color: t.color }}>{t.name}</p>
        </div>
      </div>
      {total > 1 && (
        <p className="text-xs text-on-surface-variant mt-3">
          You're ahead of <span className="font-bold text-primary">{ahead}%</span> of learners. Keep going! 🚀
        </p>
      )}
    </div>
  );
}

export default function MasterclassLeaderboard() {
  const { profile, user } = useAppStore();
  const isTeacher = profile?.role === 'teacher';
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    (async () => {
      try {
        setRows(await fetchLeaderboard());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the leaderboard.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.age_group === filter)),
    [rows, filter],
  );
  const myRow = useMemo(() => rows.find((r) => r.user_id === user?.id), [rows, user?.id]);
  const hasPoints = rows.some((r) => r.total_points > 0);
  const podium = visible.slice(0, 3);
  const rest = visible.slice(3);

  return (
    <DashboardLayout title="Leaderboard" navItems={isTeacher ? teacherMasterclassNav : masterclassNav}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: '1.7rem' }}>leaderboard</span>
            Leaderboard
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">Quiz points across the AI Masterclass · graded scores only</p>
        </div>

        {/* Cohort filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-sm font-bold transition-all ${
                filter === f.key ? 'academic-gradient text-white shadow-sm' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}>{f.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="h-64 rounded-3xl bg-surface-container/40 animate-pulse" />
        ) : error ? (
          <p className="text-sm text-error">{error}</p>
        ) : !hasPoints ? (
          <div className="text-center py-16 bg-surface-container-lowest rounded-3xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-3 block">emoji_events</span>
            <p className="text-on-surface font-bold">No points yet</p>
            <p className="text-sm text-on-surface-variant mt-1 mb-5">Be the first to top the leaderboard — complete a quiz and earn your spot.</p>
            {!isTeacher && (
              <Link to="/masterclass/quizzes" className="inline-flex items-center gap-2 px-5 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90">
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>quiz</span>View quizzes
              </Link>
            )}
          </div>
        ) : visible.length === 0 ? (
          <p className="text-sm text-on-surface-variant py-10 text-center">No learners in this cohort yet.</p>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {podium.length > 0 && <Podium rows={podium} />}

              {/* Ranked list — a flex row list (not a table) so it always fits
                  its column with no horizontal scroll; long names truncate. */}
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden divide-y divide-outline-variant/10">
                {rest.map((r, i) => {
                  const isMe = r.user_id === user?.id;
                  return (
                    <motion.div key={r.user_id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      className={`flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 ${isMe ? 'bg-primary/5' : ''}`}>
                      <span className="w-6 shrink-0 text-center font-extrabold text-on-surface-variant tabular-nums">{i + 4}</span>
                      <Avatar row={r} size={36} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="min-w-0 truncate academic-gradient text-white font-bold text-sm rounded-full px-3 py-1 shadow-sm">{r.display_name}</span>
                          {isMe && <span className="shrink-0 text-[0.55rem] font-bold uppercase tracking-widest text-primary">You</span>}
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 min-w-0">
                          <CohortChip ageGroup={r.age_group} size="sm" className="max-w-[60%] sm:max-w-none" />
                          <div className="hidden sm:flex items-center gap-1.5">
                            <div className="h-1.5 w-20 rounded-full bg-surface-container overflow-hidden">
                              <div className="h-full academic-gradient rounded-full" style={{ width: `${r.completion_percent}%` }} />
                            </div>
                            <span className="text-[0.65rem] font-bold text-on-surface-variant tabular-nums">{r.completion_percent}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right pl-1">
                        <p className="font-extrabold text-on-surface tabular-nums text-sm whitespace-nowrap">{fmtXp(r.total_points)}</p>
                        <div className="mt-1 hidden sm:flex justify-end"><TierBadge points={r.total_points} /></div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* My rank rail (students only) */}
            <div className="space-y-6">
              {!isTeacher && myRow && <MyRankCard row={myRow} total={rows.length} />}
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
                <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-3">How points work</h3>
                <ul className="space-y-2.5 text-sm text-on-surface-variant">
                  <li className="flex gap-2.5"><span className="material-symbols-outlined text-primary" style={{ fontSize: '1.1rem' }}>quiz</span>Submit quizzes for your cohort.</li>
                  <li className="flex gap-2.5"><span className="material-symbols-outlined text-primary" style={{ fontSize: '1.1rem' }}>grading</span>Your teacher grades them.</li>
                  <li className="flex gap-2.5"><span className="material-symbols-outlined text-primary" style={{ fontSize: '1.1rem' }}>bolt</span>Graded scores become XP and climb the board.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
