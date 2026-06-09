import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { masterclassNav } from '../lib/nav';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { useCountdown, formatLocal } from '../lib/time';
import { cohortMeta, isJoinableMC, recordAttendance, sessionTypeLabel, weekBanner, type AgeGroup, type MasterclassSession } from '../lib/masterclass';

export default function Masterclass() {
  const { profile } = useAppStore();
  const ageGroup = profile?.age_group as AgeGroup | undefined;
  const cohort = ageGroup ? cohortMeta[ageGroup] : undefined;
  const firstName = (profile?.full_name || 'there').split(' ')[0];

  const [sessions, setSessions] = useState<MasterclassSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('masterclass_sessions')
        .select('*')
        .neq('status', 'cancelled')
        .order('scheduled_at');
      setSessions((data as MasterclassSession[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const now = Date.now();
  const next = sessions.find((s) => new Date(s.scheduled_at).getTime() + s.duration_min * 60_000 > now && s.status !== 'completed');
  const countdown = useCountdown(next?.scheduled_at ?? null);
  const joinable = next ? isJoinableMC(next.scheduled_at, next.duration_min) : false;
  const upcoming = sessions.filter((s) => s.id !== next?.id && new Date(s.scheduled_at).getTime() > now).slice(0, 3);

  return (
    <DashboardLayout title="AI Masterclass" navItems={masterclassNav}>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-on-surface tracking-tight">Welcome, {firstName} 👋</h2>
            {cohort && <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cohort.badge}`}>{cohort.label}</span>}
          </div>
          {/* Mobile-only quick links — Feed & Settings aren't in the 4-tab bottom bar. */}
          <div className="flex items-center gap-1 lg:hidden shrink-0">
            <Link to="/masterclass/feed" aria-label="AI Feed" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '1.3rem' }}>feed</span>
            </Link>
            <Link to="/masterclass/settings" aria-label="Settings" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '1.3rem' }}>settings</span>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="h-48 rounded-2xl bg-surface-container/40 animate-pulse" />
        ) : next ? (
          <div className="relative rounded-2xl academic-gradient text-white p-6 sm:p-8 shadow-xl overflow-hidden">
            <img src={weekBanner(next.week_number)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#00193c] via-[#00193c]/85 to-transparent" />
            <div className="relative">
              <p className="text-[0.65rem] font-bold uppercase tracking-widest text-white/70">Next up · Week {next.week_number} · {sessionTypeLabel[next.session_type]}</p>
              <h3 className="text-xl font-bold mt-1.5">{next.title}</h3>
              <p className="text-sm text-white/80 mt-1">{formatLocal(next.scheduled_at, 'EEEE, MMM d · h:mm a')}</p>

              {!joinable ? (
                <div className="flex gap-2.5 mt-6">
                  {([['days', countdown.days], ['hrs', countdown.hours], ['min', countdown.minutes], ['sec', countdown.seconds]] as const).map(([label, val]) => (
                    <div key={label} className="flex-1 bg-white/10 rounded-xl py-3 text-center backdrop-blur-sm">
                      <div className="text-2xl font-extrabold tabular-nums leading-none" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{String(val).padStart(2, '0')}</div>
                      <div className="text-[0.6rem] font-bold uppercase tracking-widest text-white/60 mt-1.5">{label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <a href={next.meeting_link} target="_blank" rel="noopener noreferrer" onClick={() => recordAttendance(next.id)} className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-white text-primary font-bold text-sm rounded-xl shadow-lg hover:bg-white/90 transition-all active:scale-[0.98]">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>video_call</span>
                  Join class now
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-8 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '1.5rem' }}>event_upcoming</span>
            </div>
            <h3 className="text-lg font-bold text-on-surface mb-1">No upcoming classes yet</h3>
            <p className="text-sm text-on-surface-variant max-w-md mx-auto">Your teacher hasn't scheduled your next session. We'll email you the moment one is set.</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Coming up</h3>
              <Link to="/masterclass/sessions" className="text-xs font-bold text-primary hover:underline">View all →</Link>
            </div>
            <div className="space-y-2">
              {upcoming.map((s) => (
                <Link key={s.id} to={`/masterclass/sessions/${s.id}`} className="flex items-center gap-4 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/10 hover:border-outline-variant/25 transition-all">
                  <div className="relative shrink-0 w-20 h-[45px] rounded-lg overflow-hidden academic-gradient">
                    <img src={weekBanner(s.week_number)} alt="" loading="lazy" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0.5 left-1 text-[0.5rem] font-extrabold text-white drop-shadow">Wk {s.week_number}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-on-surface text-sm truncate">{s.title}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{formatLocal(s.scheduled_at, 'EEE, MMM d · h:mm a')}</p>
                  </div>
                  <span className="material-symbols-outlined text-outline" style={{ fontSize: '1.2rem' }}>chevron_right</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
