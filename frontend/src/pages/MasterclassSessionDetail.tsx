import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { masterclassNav } from '../lib/nav';
import Markdown from '../components/Markdown';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { formatLocal } from '../lib/time';
import { isJoinableMC, parseSessionLinks, recordAttendance, sessionStatusBadge, sessionTypeLabel, weekBanner, type AgeGroup, type MasterclassSession } from '../lib/masterclass';

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
  const recordings = parseSessionLinks(session.recording_url);

  return (
    <DashboardLayout title={`Week ${session.week_number}`} navItems={masterclassNav}>
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/masterclass/sessions')} className="inline-flex items-center gap-1 text-sm font-bold text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_back</span>Sessions
        </button>

        <div className="relative aspect-[16/9] rounded-2xl overflow-hidden academic-gradient shadow-lg">
          <img src={weekBanner(session.week_number)} alt="" className="w-full h-full object-cover" />
          <span className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-[0.6rem] font-bold uppercase tracking-widest">Week {session.week_number}</span>
        </div>

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

        {session.agenda_md && <AgendaCard md={session.agenda_md} />}

        {myActivity && <ActivityCard text={myActivity} />}

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

        {recordings.length > 0 && (
          <Section icon="smart_display" title={recordings.length > 1 ? 'Recordings' : 'Recording'}>
            <div className="flex flex-col gap-2.5">
              {recordings.map((r, i) => (
                <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
                  {r.label || (recordings.length > 1 ? `Watch recording ${i + 1}` : 'Watch the recording')}
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>open_in_new</span>
                </a>
              ))}
            </div>
          </Section>
        )}

        {session.summary_md && (
          <Section icon="description" title="What we covered">
            <Markdown source={session.summary_md} />
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

// ── Agenda rendering ─────────────────────────────────────────────────────────
// The agenda is stored as plain text: blocks separated by a blank line, each
// starting with an "emoji Title" header line, followed by paragraph or "• " bullets.
// We parse that into styled, icon-badged sections so it reads well for all ages.
interface AgendaBlock { title: string; tone: SectionTone; paras: string[]; bullets: string[] }
interface SectionTone { icon: string; chip: string }

function toneFor(header: string): SectionTone {
  const h = header.toLowerCase();
  if (h.includes('main idea')) return { icon: 'lightbulb', chip: 'bg-amber-500/15 text-amber-600' };
  if (h.includes('cover')) return { icon: 'checklist', chip: 'bg-primary/10 text-primary' };
  if (h.includes('demo')) return { icon: 'play_circle', chip: 'bg-sky-500/15 text-sky-600' };
  if (h.includes('format')) return { icon: 'dashboard', chip: 'bg-sky-500/15 text-sky-600' };
  if (h.includes('present')) return { icon: 'co_present', chip: 'bg-primary/10 text-primary' };
  if (h.includes('homework')) return { icon: 'assignment', chip: 'bg-secondary/10 text-secondary' };
  if (h.includes('by the end')) return { icon: 'check_circle', chip: 'bg-emerald-500/15 text-emerald-600' };
  if (h.includes('safety') || h.includes('note')) return { icon: 'shield', chip: 'bg-rose-500/15 text-rose-600' };
  if (h.includes('certificate')) return { icon: 'workspace_premium', chip: 'bg-amber-500/15 text-amber-600' };
  return { icon: 'arrow_right', chip: 'bg-surface-container text-on-surface-variant' };
}

function parseAgenda(md: string): AgendaBlock[] {
  return md.split(/\n\s*\n/).map((raw) => {
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const header = lines[0] ?? '';
    // Strip leading emoji / symbols / whitespace to get the clean title text.
    const title = header.replace(/^[^\p{L}]+/u, '').trim();
    const body = lines.slice(1);
    const bullets = body.filter((l) => l.startsWith('•')).map((l) => l.replace(/^•\s*/, ''));
    const paras = body.filter((l) => !l.startsWith('•'));
    return { title, tone: toneFor(header), paras, bullets };
  }).filter((b) => b.title || b.paras.length || b.bullets.length);
}

function AgendaCard({ md }: { md: string }) {
  const blocks = parseAgenda(md);
  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="material-symbols-outlined text-primary/70" style={{ fontSize: '1.1rem' }}>list_alt</span>
        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Agenda</h3>
      </div>
      <div className="space-y-5">
        {blocks.map((b, i) => (
          <div key={i} className="flex gap-3.5">
            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${b.tone.chip}`}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>{b.tone.icon}</span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h4 className="text-sm font-bold text-on-surface">{b.title}</h4>
              {b.paras.map((p, j) => (
                <p key={j} className="mt-1 text-sm text-on-surface-variant leading-relaxed">{p}</p>
              ))}
              {b.bullets.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {b.bullets.map((t, j) => (
                    <li key={j} className="flex gap-2.5 text-sm text-on-surface leading-relaxed">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityCard({ text }: { text: string }) {
  // Activity text is "<task>\nGo further: <stretch>" — split so the stretch goal stands out.
  const idx = text.search(/go further:/i);
  const main = idx >= 0 ? text.slice(0, idx).trim() : text.trim();
  const further = idx >= 0 ? text.slice(idx).replace(/go further:/i, '').trim() : '';
  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-primary/70" style={{ fontSize: '1.1rem' }}>interactive_space</span>
        <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Your activity</h3>
      </div>
      <p className="text-sm text-on-surface leading-relaxed">{main}</p>
      {further && (
        <div className="mt-3 flex gap-2.5 rounded-xl bg-primary/5 border border-primary/15 p-3.5">
          <span className="material-symbols-outlined text-primary shrink-0" style={{ fontSize: '1.15rem' }}>rocket_launch</span>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-primary/80">Go further</p>
            <p className="mt-0.5 text-sm text-on-surface-variant leading-relaxed">{further}</p>
          </div>
        </div>
      )}
    </div>
  );
}
