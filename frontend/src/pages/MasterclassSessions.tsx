import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { masterclassNav } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { formatLocal } from '../lib/time';
import { isJoinableMC, masterclassHeroBanner, sessionStatusBadge, sessionTypeLabel, weekBanner, type MasterclassSession } from '../lib/masterclass';

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
        <div className="relative rounded-2xl overflow-hidden academic-gradient text-white shadow-lg">
          <img src={masterclassHeroBanner} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#00193c] via-[#00193c]/80 to-transparent" />
          <div className="relative p-6 sm:p-8">
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-white/70">Zero to Hero · AI Sessions</p>
            <h2 className="text-2xl font-bold tracking-tight mt-1.5">Your 12-week journey</h2>
            <p className="text-sm text-white/80 mt-1">{sessions.length} session{sessions.length !== 1 ? 's' : ''} scheduled</p>
          </div>
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
          <div className="grid sm:grid-cols-2 gap-4">
            {sessions.map((s) => {
              const joinable = isJoinableMC(s.scheduled_at, s.duration_min);
              return (
                <Link key={s.id} to={`/masterclass/sessions/${s.id}`} className="group rounded-2xl overflow-hidden bg-surface-container-lowest border border-outline-variant/10 hover:border-outline-variant/25 hover:shadow-lg transition-all">
                  <div className="relative aspect-[16/9] academic-gradient overflow-hidden">
                    <img src={weekBanner(s.week_number)} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                    <span className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-[0.6rem] font-bold uppercase tracking-widest">Week {s.week_number}</span>
                    {joinable && (
                      <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 bg-primary text-on-primary text-[0.6rem] font-bold rounded-full shadow-lg">
                        <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>video_call</span>Live
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.55rem] font-bold uppercase tracking-widest ${sessionStatusBadge[s.status]}`}>{s.status}</span>
                      {s.session_type !== 'class' && <span className="text-[0.55rem] font-bold uppercase tracking-widest text-secondary/50">{sessionTypeLabel[s.session_type]}</span>}
                    </div>
                    <p className="font-bold text-on-surface text-sm">{s.title}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{formatLocal(s.scheduled_at, 'EEE, MMM d · h:mm a')}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
