import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../lib/useToast';
import { teacherNav } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { formatLocal } from '../lib/time';
import {
  cohortMeta, sessionStatusBadge, sessionTypeLabel, buildSchedule,
  type Cohort, type MasterclassSession, type ToolItem,
} from '../lib/masterclass';

const blankForm = {
  week_number: 1,
  title: '',
  session_type: 'class' as MasterclassSession['session_type'],
  scheduled_at: '',
  duration_min: 120,
  meeting_link: '',
  cohort_ids: [] as string[],
  agenda_md: '',
  activity_little_ones: '',
  activity_juniors: '',
  activity_advanced: '',
  tools_text: '',          // "Name, https://url" per line
  recording_url: '',
  summary_md: '',
};
type FormState = typeof blankForm;

const toolsToText = (tools: ToolItem[] | null) =>
  (tools ?? []).map((t) => `${t.name}, ${t.url}`).join('\n');

const textToTools = (text: string): ToolItem[] =>
  text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const idx = line.lastIndexOf(',');
    if (idx === -1) return { name: line, url: '' };
    return { name: line.slice(0, idx).trim(), url: line.slice(idx + 1).trim() };
  });

export default function TeacherMasterclassSessions() {
  const toast = useToast();
  const [sessions, setSessions] = useState<MasterclassSession[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [showGen, setShowGen] = useState(false);
  const [gen, setGen] = useState({ first: '', meeting_link: '', duration_min: 120, cohort_ids: [] as string[] });

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from('masterclass_sessions').select('*').order('week_number'),
      supabase.from('cohorts').select('*').order('created_at'),
    ]);
    setSessions((s as MasterclassSession[]) ?? []);
    setCohorts((c as Cohort[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditingId(null); setForm({ ...blankForm, cohort_ids: cohorts.map((c) => c.id) }); setShowForm(true); };
  const openEdit = (s: MasterclassSession) => {
    setEditingId(s.id);
    setForm({
      week_number: s.week_number,
      title: s.title,
      session_type: s.session_type,
      scheduled_at: s.scheduled_at ? new Date(s.scheduled_at).toISOString().slice(0, 16) : '',
      duration_min: s.duration_min,
      meeting_link: s.meeting_link || '',
      cohort_ids: s.cohort_ids ?? [],
      agenda_md: s.agenda_md ?? '',
      activity_little_ones: s.activity_little_ones ?? '',
      activity_juniors: s.activity_juniors ?? '',
      activity_advanced: s.activity_advanced ?? '',
      tools_text: toolsToText(s.tools_needed),
      recording_url: s.recording_url ?? '',
      summary_md: s.summary_md ?? '',
    });
    setShowForm(true);
  };

  const toggle = (arr: string[], id: string) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const save = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.scheduled_at) { toast.error('Date & time is required'); return; }
    if (!form.meeting_link.trim()) { toast.error('Meeting link is required'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      week_number: form.week_number,
      title: form.title.trim(),
      session_type: form.session_type,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_min: form.duration_min,
      meeting_link: form.meeting_link.trim(),
      cohort_ids: form.cohort_ids,
      agenda_md: form.agenda_md || null,
      activity_little_ones: form.activity_little_ones || null,
      activity_juniors: form.activity_juniors || null,
      activity_advanced: form.activity_advanced || null,
      tools_needed: form.tools_text.trim() ? textToTools(form.tools_text) : null,
      recording_url: form.recording_url || null,
      summary_md: form.summary_md || null,
    };
    const { error } = editingId
      ? await supabase.from('masterclass_sessions').update(payload).eq('id', editingId)
      : await supabase.from('masterclass_sessions').insert({ ...payload, created_by: user?.id });
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? 'Session updated' : 'Session created');
    setShowForm(false);
    load();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('masterclass_sessions').update({ status }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    const { error } = await supabase.from('masterclass_sessions').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Session deleted');
    load();
  };

  const runGenerator = async () => {
    if (!gen.first) { toast.error('Pick the first session date & time'); return; }
    if (!gen.meeting_link.trim()) { toast.error('A default meeting link is required'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const rows = buildSchedule(gen.first, gen.meeting_link.trim(), gen.cohort_ids, gen.duration_min)
      .map((r) => ({ ...r, created_by: user?.id }));
    const { error } = await supabase.from('masterclass_sessions').insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success('12-week schedule created');
    setShowGen(false);
    setGen({ first: '', meeting_link: '', duration_min: 120, cohort_ids: [] });
    load();
  };

  const cohortBadges = (ids: string[]) => {
    if (!ids || ids.length === 0) return <span className="text-[0.6rem] font-bold uppercase tracking-widest text-amber-600">No cohorts — hidden from students</span>;
    return ids.map((id) => {
      const c = cohorts.find((x) => x.id === id);
      if (!c) return null;
      const m = cohortMeta[c.age_group];
      return <span key={id} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${m.badge}`}>{c.name}</span>;
    });
  };

  return (
    <DashboardLayout title="Masterclass Sessions" navItems={teacherNav}>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-primary tracking-tight">Masterclass Sessions</h2>
            <p className="text-on-surface-variant text-sm mt-1">{sessions.length} of 12 weeks scheduled</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowGen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-surface-container text-on-surface text-sm font-bold rounded-xl hover:bg-surface-container-high transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>auto_awesome</span>
              Generate 12 weeks
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
              New session
            </button>
          </div>
        </div>

        {cohorts.length === 0 && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 text-amber-800 text-sm">
            <span className="material-symbols-outlined text-base mt-0.5 shrink-0">info</span>
            <span>No cohorts exist yet. Create one on the Cohorts page first, or students create one when they onboard — sessions need a cohort target to be visible to students.</span>
          </div>
        )}

        {loading ? (
          <p className="text-on-surface-variant text-sm">Loading…</p>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">event</span>
            <p className="text-on-surface-variant font-medium">No sessions scheduled.</p>
            <p className="text-sm text-on-surface-variant mt-1">Use “Generate 12 weeks” to create the full curriculum at once.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center">
                    <span className="text-[0.55rem] font-bold uppercase tracking-wider text-primary/60">Wk</span>
                    <span className="text-lg font-extrabold text-primary leading-none">{s.week_number}</span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-widest ${sessionStatusBadge[s.status]}`}>{s.status}</span>
                      <span className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50">{sessionTypeLabel[s.session_type]}</span>
                    </div>
                    <h3 className="font-bold text-on-surface">{s.title}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                      <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-primary/70" style={{ fontSize: '0.9rem' }}>schedule</span><span className="font-bold text-primary/80">{formatLocal(s.scheduled_at)}</span></span>
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>timer</span>{s.duration_min} min</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">{cohortBadges(s.cohort_ids)}</div>
                  </div>
                  <div className="flex flex-wrap items-start gap-2 shrink-0">
                    {s.status === 'scheduled' && (
                      <button onClick={() => setStatus(s.id, 'completed')} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-xl hover:bg-emerald-100 transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check_circle</span>Complete
                      </button>
                    )}
                    <button onClick={() => openEdit(s)} title="Edit" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container text-secondary transition-colors"><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>edit</span></button>
                    <button onClick={() => setPendingDeleteId(s.id)} title="Delete" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-error-container/30 text-error transition-colors"><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>delete</span></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Edit session' : 'New session'} maxWidth="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Week</label>
              <input type="number" min={1} max={12} className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.week_number} onChange={(e) => setForm((p) => ({ ...p, week_number: +e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Type</label>
              <select className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.session_type} onChange={(e) => setForm((p) => ({ ...p, session_type: e.target.value as MasterclassSession['session_type'] }))}>
                {Object.entries(sessionTypeLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Title</label>
            <input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Date & time</label>
              <input type="datetime-local" className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.scheduled_at} onChange={(e) => setForm((p) => ({ ...p, scheduled_at: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Duration (min)</label>
              <input type="number" min={15} className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.duration_min} onChange={(e) => setForm((p) => ({ ...p, duration_min: +e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Meeting link (Zoom / Meet)</label>
            <input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="https://…" value={form.meeting_link} onChange={(e) => setForm((p) => ({ ...p, meeting_link: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Target cohorts</label>
            {cohorts.length === 0 ? <p className="text-xs text-on-surface-variant">No cohorts available.</p> : (
              <div className="flex flex-wrap gap-2">
                {cohorts.map((c) => {
                  const on = form.cohort_ids.includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => setForm((p) => ({ ...p, cohort_ids: toggle(p.cohort_ids, c.id) }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${on ? cohortMeta[c.age_group].badge + ' border-transparent' : 'border-outline-variant/50 text-on-surface-variant'}`}>
                      {on && '✓ '}{c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Agenda (Markdown)</label>
            <textarea className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface resize-none h-20" value={form.agenda_md} onChange={(e) => setForm((p) => ({ ...p, agenda_md: e.target.value }))} />
          </div>
          <details className="rounded-xl bg-surface-container/40 px-4 py-3">
            <summary className="text-xs font-bold uppercase tracking-widest text-on-surface-variant cursor-pointer">Per-cohort activities & tools</summary>
            <div className="space-y-3 mt-3">
              <textarea placeholder="Activity — Little Ones" className="w-full px-4 py-2.5 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface resize-none h-16" value={form.activity_little_ones} onChange={(e) => setForm((p) => ({ ...p, activity_little_ones: e.target.value }))} />
              <textarea placeholder="Activity — Juniors" className="w-full px-4 py-2.5 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface resize-none h-16" value={form.activity_juniors} onChange={(e) => setForm((p) => ({ ...p, activity_juniors: e.target.value }))} />
              <textarea placeholder="Activity — Advanced" className="w-full px-4 py-2.5 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface resize-none h-16" value={form.activity_advanced} onChange={(e) => setForm((p) => ({ ...p, activity_advanced: e.target.value }))} />
              <div>
                <label className="block text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Tools — one per line: “Name, https://url”</label>
                <textarea className="w-full px-4 py-2.5 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface resize-none h-16" value={form.tools_text} onChange={(e) => setForm((p) => ({ ...p, tools_text: e.target.value }))} />
              </div>
            </div>
          </details>
          {editingId && (
            <details className="rounded-xl bg-surface-container/40 px-4 py-3">
              <summary className="text-xs font-bold uppercase tracking-widest text-on-surface-variant cursor-pointer">After the session</summary>
              <div className="space-y-3 mt-3">
                <input placeholder="Recording URL" className="w-full px-4 py-2.5 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.recording_url} onChange={(e) => setForm((p) => ({ ...p, recording_url: e.target.value }))} />
                <textarea placeholder="Summary (Markdown)" className="w-full px-4 py-2.5 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface resize-none h-20" value={form.summary_md} onChange={(e) => setForm((p) => ({ ...p, summary_md: e.target.value }))} />
              </div>
            </details>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl hover:bg-surface-container">Cancel</button>
          <button onClick={save} className="px-5 py-2.5 text-sm font-bold academic-gradient text-white rounded-xl shadow-md hover:opacity-90">{editingId ? 'Save' : 'Create'}</button>
        </div>
      </Modal>

      {/* Generator modal */}
      <Modal open={showGen} onClose={() => setShowGen(false)} title="Generate 12-week schedule">
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">Creates all 12 sessions, one per week, pre-filled with curriculum titles. Edit any session afterwards.</p>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">First session — date & time</label>
            <input type="datetime-local" className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={gen.first} onChange={(e) => setGen((p) => ({ ...p, first: e.target.value }))} />
            <p className="text-[0.65rem] text-on-surface-variant mt-1">Weeks 2–12 repeat on the same weekday & time.</p>
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Default meeting link</label>
            <input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="https://…" value={gen.meeting_link} onChange={(e) => setGen((p) => ({ ...p, meeting_link: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Duration (min)</label>
            <input type="number" min={15} className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={gen.duration_min} onChange={(e) => setGen((p) => ({ ...p, duration_min: +e.target.value }))} />
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Target cohorts</label>
            {cohorts.length === 0 ? <p className="text-xs text-amber-600">Create a cohort first so students can see these sessions.</p> : (
              <div className="flex flex-wrap gap-2">
                {cohorts.map((c) => {
                  const on = gen.cohort_ids.includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => setGen((p) => ({ ...p, cohort_ids: toggle(p.cohort_ids, c.id) }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${on ? cohortMeta[c.age_group].badge + ' border-transparent' : 'border-outline-variant/50 text-on-surface-variant'}`}>
                      {on && '✓ '}{c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={() => setShowGen(false)} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl hover:bg-surface-container">Cancel</button>
          <button onClick={runGenerator} className="px-5 py-2.5 text-sm font-bold academic-gradient text-white rounded-xl shadow-md hover:opacity-90">Generate</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Delete session?"
        message="This permanently removes the session for all targeted cohorts."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </DashboardLayout>
  );
}
