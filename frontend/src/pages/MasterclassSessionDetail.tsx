import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { masterclassNav } from '../lib/nav';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { formatLocal } from '../lib/time';
import { isJoinableMC, recordAttendance, sessionStatusBadge, sessionTypeLabel, type AgeGroup, type MasterclassSession } from '../lib/masterclass';

const activityField: Record<AgeGroup, keyof MasterclassSession> = {
  little_ones: 'activity_little_ones',
  juniors: 'activity_juniors',
  advanced: 'activity_advanced',
};

export default function MasterclassSessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAppStore();
  const ageGroup = profile?.age_group as AgeGroup | undefined;
  const [session, setSession] = useState<MasterclassSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('masterclass_sessions').select('*').eq('id', id).single();
      setSession((data as MasterclassSession) ?? null);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout title="Session" navItems={masterclassNav}>
        <div className="max-w-2xl mx-auto h-64 rounded-2xl bg-surface-container/40 animate-pulse" />
      </DashboardLayout>
    );
  }

  if (!session) {
    return (
      <DashboardLayout title="Session" navItems={masterclassNav}>
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-on-surface-variant font-medium">Session not found.</p>
          <button onClick={() => navigate('/masterclass/sessions')} className="mt-4 text-sm font-bold text-primary hover:underline">← Back to sessions</button>
        </div>
      </DashboardLayout>
    );
  }

  const myActivity = ageGroup ? (session[activityField[ageGroup]] as string | null) : null;
  const joinable = isJoinableMC(session.scheduled_at, session.duration_min);
  const tools = session.tools_needed ?? [];

  return (
    <DashboardLayout title={`Week ${session.week_number}`} navItems={masterclassNav}>
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/masterclass/sessions')} className="inline-flex items-center gap-1 text-sm font-bold text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_back</span>Sessions
        </button>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-widest ${sessionStatusBadge[session.status]}`}>{session.status}</span>
            <span className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50">Week {session.week_number} · {sessionTypeLabel[session.session_type]}</span>
          </div>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">{session.title}</h2>
          <p className="text-sm text-on-surface-variant mt-1.5 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary/70" style={{ fontSize: '1rem' }}>schedule</span>
            {formatLocal(session.scheduled_at, 'EEEE, MMM d, yyyy · h:mm a')} · {session.duration_min} min
          </p>
        </div>

        {session.status !== 'completed' && session.status !== 'cancelled' && (
          joinable ? (
            <a href={session.meeting_link} target="_blank" rel="noopener noreferrer" onClick={() => recordAttendance(session.id)} className="inline-flex items-center gap-2 px-6 py-3 academic-gradient text-white font-bold text-sm rounded-xl shadow-lg hover:opacity-90 transition-all active:scale-[0.98]">
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>video_call</span>Join class now
            </a>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-container text-on-surface-variant text-xs font-bold uppercase tracking-widest rounded-xl">
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>lock_clock</span>Join opens 10 min before
            </div>
          )
        )}

        {session.agenda_md && (
          <Section icon="list_alt" title="Agenda">
            <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">{session.agenda_md}</p>
          </Section>
        )}

        {myActivity && (
          <Section icon="interactive_space" title="Your activity">
            <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">{myActivity}</p>
          </Section>
        )}

        {tools.length > 0 && (
          <Section icon="build" title="Tools you'll need">
            <div className="flex flex-wrap gap-2">
              {tools.map((t, i) => t.url ? (
                <a key={i} href={t.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors">
                  {t.name}<span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>open_in_new</span>
                </a>
              ) : (
                <span key={i} className="inline-flex items-center px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant text-xs font-bold">{t.name}</span>
              ))}
            </div>
          </Section>
        )}

        {session.recording_url && (
          <Section icon="smart_display" title="Recording">
            <a href={session.recording_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
              Watch the recording<span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>open_in_new</span>
            </a>
          </Section>
        )}

        {session.summary_md && (
          <Section icon="description" title="What we covered">
            <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">{session.summary_md}</p>
          </Section>
        )}
      </div>
    </DashboardLayout>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-primary/70" style={{ fontSize: '1.1rem' }}>{icon}</span>
        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{title}</h3>
      </div>
      {children}
    </div>
  );
}
