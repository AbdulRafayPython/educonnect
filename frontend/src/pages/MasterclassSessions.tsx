import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { masterclassNav } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { formatLocal } from '../lib/time';
import { isJoinableMC, sessionStatusBadge, sessionTypeLabel, type MasterclassSession } from '../lib/masterclass';

export default function MasterclassSessions() {
  const [sessions, setSessions] = useState<MasterclassSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('masterclass_sessions').select('*').order('week_number');
      setSessions((data as MasterclassSession[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <DashboardLayout title="Sessions" navItems={masterclassNav}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">Your 12-week journey</h2>
          <p className="text-on-surface-variant text-sm mt-1">{sessions.length} session{sessions.length !== 1 ? 's' : ''} scheduled</p>
        </div>

        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-surface-container/40 animate-pulse" />)}</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">event_upcoming</span>
            <p className="text-on-surface-variant font-medium">No sessions scheduled yet.</p>
            <p className="text-sm text-on-surface-variant mt-1">We'll email you when your teacher sets the schedule.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sessions.map((s) => {
              const joinable = isJoinableMC(s.scheduled_at, s.duration_min);
              return (
                <Link key={s.id} to={`/masterclass/sessions/${s.id}`} className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/10 hover:border-outline-variant/25 transition-all">
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-primary/10 flex flex-col items-center justify-center">
                    <span className="text-[0.5rem] font-bold uppercase text-primary/60 leading-none">Wk</span>
                    <span className="text-base font-extrabold text-primary leading-none">{s.week_number}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.55rem] font-bold uppercase tracking-widest ${sessionStatusBadge[s.status]}`}>{s.status}</span>
                      {s.session_type !== 'class' && <span className="text-[0.55rem] font-bold uppercase tracking-widest text-secondary/50">{sessionTypeLabel[s.session_type]}</span>}
                    </div>
                    <p className="font-bold text-on-surface text-sm truncate">{s.title}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{formatLocal(s.scheduled_at, 'EEE, MMM d · h:mm a')}</p>
                  </div>
                  {joinable ? (
                    <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-on-primary text-[0.65rem] font-bold rounded-lg">
                      <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>video_call</span>Live
                    </span>
                  ) : (
                    <span className="material-symbols-outlined text-outline" style={{ fontSize: '1.2rem' }}>chevron_right</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
