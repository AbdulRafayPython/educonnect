import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import Markdown from '../components/Markdown';
import ConfirmDialog from '../components/ConfirmDialog';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../lib/useToast';
import { teacherNav } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { formatLocal } from '../lib/time';
import { cohortMeta, type Cohort, type MasterclassHomework, type HomeworkSubmission } from '../lib/masterclass';

const SAMPLE = `## Objective
Today we learned: **Better Question = Better AI Answer**.

## Task
Pick one topic from daily life, then write two prompts for it.

### Prompt 1 (Normal)
A simple question most people would ask.

### Prompt 2 (Better)
The same question with more detail and clear instructions.

## What to submit
1. Your chosen topic
2. Normal prompt + Better prompt
3. The AI answer for both
4. Which was better and why?`;

const blankForm = {
  week_number: 1 as number | '',
  title: '',
  instructions_md: '',
  due_date: '',
  points: '' as number | '',
  cohort_ids: [] as string[],
};
type FormState = typeof blankForm;

export default function TeacherMasterclassHomework() {
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<MasterclassHomework[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [counts, setCounts] = useState<Record<string, { total: number; graded: number }>>({});
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [existingAttachment, setExistingAttachment] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: h }, { data: c }, { data: s }] = await Promise.all([
      supabase.from('masterclass_homework').select('*').order('created_at', { ascending: false }),
      supabase.from('cohorts').select('*').order('created_at'),
      supabase.from('masterclass_homework_submissions').select('homework_id, status'),
    ]);
    setItems((h as MasterclassHomework[]) ?? []);
    setCohorts((c as Cohort[]) ?? []);
    const map: Record<string, { total: number; graded: number }> = {};
    (s as Pick<HomeworkSubmission, 'homework_id' | 'status'>[] ?? []).forEach((sub) => {
      const e = (map[sub.homework_id] ??= { total: 0, graded: 0 });
      e.total += 1;
      if (sub.status !== 'submitted') e.graded += 1;
    });
    setCounts(map);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...blankForm, cohort_ids: cohorts.map((c) => c.id) });
    setExistingAttachment(null);
    setAttachment(null);
    setPreview(false);
    setShowForm(true);
  };
  const openEdit = (h: MasterclassHomework) => {
    setEditingId(h.id);
    setForm({
      week_number: h.week_number ?? '',
      title: h.title,
      instructions_md: h.instructions_md,
      due_date: h.due_date ? new Date(h.due_date).toISOString().slice(0, 16) : '',
      points: h.points ?? '',
      cohort_ids: h.cohort_ids ?? [],
    });
    setExistingAttachment(h.attachment_path);
    setAttachment(null);
    setPreview(false);
    setShowForm(true);
  };

  const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const save = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.instructions_md.trim()) { toast.error('Instructions are required'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    let attachment_path = existingAttachment;
    if (attachment) {
      const path = `homework/${Date.now()}-${attachment.name.replace(/[^\w.-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('masterclass-materials').upload(path, attachment);
      if (upErr) { toast.error('Attachment upload failed', upErr.message); setSaving(false); return; }
      attachment_path = path;
    }

    const payload = {
      week_number: form.week_number === '' ? null : Number(form.week_number),
      title: form.title.trim(),
      instructions_md: form.instructions_md,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      points: form.points === '' ? null : Number(form.points),
      cohort_ids: form.cohort_ids,
      attachment_path,
    };

    const { error } = editingId
      ? await supabase.from('masterclass_homework').update(payload).eq('id', editingId)
      : await supabase.from('masterclass_homework').insert({ ...payload, created_by: user?.id });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? 'Homework updated' : 'Homework assigned');
    setShowForm(false);
    load();
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    const { error } = await supabase.from('masterclass_homework').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Homework deleted');
    load();
  };

  const cohortBadges = (ids: string[]) => {
    if (!ids || ids.length === 0) return <span className="text-[0.6rem] font-bold uppercase tracking-widest text-amber-600">No cohorts — hidden from students</span>;
    return ids.map((id) => {
      const c = cohorts.find((x) => x.id === id);
      if (!c) return null;
      return <span key={id} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${cohortMeta[c.age_group].badge}`}>{c.name}</span>;
    });
  };

  return (
    <DashboardLayout title="Masterclass Homework" navItems={teacherNav}>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-primary tracking-tight">Homework</h2>
            <p className="text-on-surface-variant text-sm mt-1">{items.length} assignment{items.length === 1 ? '' : 's'}</p>
          </div>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 transition-all">
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
            Assign homework
          </button>
        </div>

        {loading ? (
          <p className="text-on-surface-variant text-sm">Loading…</p>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">assignment</span>
            <p className="text-on-surface-variant font-medium">No homework assigned yet.</p>
            <p className="text-sm text-on-surface-variant mt-1">Create your first assignment — students see it instantly.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((h) => {
              const c = counts[h.id] ?? { total: 0, graded: 0 };
              return (
                <div key={h.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: '1.4rem' }}>assignment</span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {h.week_number != null && <span className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50">Week {h.week_number}</span>}
                        <span className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50">{h.points != null ? `${h.points} pts` : 'Review only'}</span>
                      </div>
                      <h3 className="font-bold text-on-surface">{h.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                        {h.due_date && <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-primary/70" style={{ fontSize: '0.9rem' }}>event</span><span className="font-bold text-primary/80">Due {formatLocal(h.due_date, 'MMM d, h:mm a')}</span></span>}
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>group</span>{c.total} submitted · {c.graded} graded</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">{cohortBadges(h.cohort_ids)}</div>
                    </div>
                    <div className="flex flex-wrap items-start gap-2 shrink-0">
                      <button onClick={() => navigate(`/teacher/masterclass/homework/${h.id}/submissions`)} className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary text-xs font-bold rounded-xl hover:bg-primary/20 transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>grading</span>Submissions
                      </button>
                      <button onClick={() => openEdit(h)} title="Edit" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container text-secondary transition-colors"><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>edit</span></button>
                      <button onClick={() => setPendingDeleteId(h.id)} title="Delete" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-error-container/30 text-error transition-colors"><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>delete</span></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingId ? 'Edit homework' : 'Assign homework'} maxWidth="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Week (optional)</label>
              <input type="number" min={1} max={12} className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.week_number} onChange={(e) => setForm((p) => ({ ...p, week_number: e.target.value === '' ? '' : +e.target.value }))} />
            </div>
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Points (optional)</label>
              <input type="number" min={0} placeholder="—" className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.points} onChange={(e) => setForm((p) => ({ ...p, points: e.target.value === '' ? '' : +e.target.value }))} />
            </div>
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Due date</label>
              <input type="datetime-local" className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.due_date} onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Title</label>
            <input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="Week 1 Homework — Better prompts" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant">Instructions (Markdown)</label>
              <div className="flex items-center gap-2">
                {!form.instructions_md && (
                  <button type="button" onClick={() => setForm((p) => ({ ...p, instructions_md: SAMPLE }))} className="text-[0.65rem] font-bold text-primary hover:underline">Use sample</button>
                )}
                <button type="button" onClick={() => setPreview((v) => !v)} className="text-[0.65rem] font-bold text-primary hover:underline">{preview ? 'Edit' : 'Preview'}</button>
              </div>
            </div>
            {preview ? (
              <div className="min-h-[10rem] px-4 py-3 rounded-xl bg-surface-variant/20 border border-outline-variant/20">
                {form.instructions_md ? <Markdown source={form.instructions_md} /> : <p className="text-sm text-on-surface-variant italic">Nothing to preview yet.</p>}
              </div>
            ) : (
              <textarea className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface resize-none h-48 font-mono" placeholder="Use # headings, **bold**, - lists, 1. steps…" value={form.instructions_md} onChange={(e) => setForm((p) => ({ ...p, instructions_md: e.target.value }))} />
            )}
            <p className="text-[0.65rem] text-on-surface-variant mt-1">Supports headings (#), **bold**, *italic*, lists, links and rules (---).</p>
          </div>

          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Attachment (optional)</label>
            {existingAttachment && !attachment && (
              <p className="text-xs text-on-surface-variant mb-1 flex items-center gap-1.5"><span className="material-symbols-outlined text-primary/70" style={{ fontSize: '1rem' }}>attach_file</span>{existingAttachment.split('/').pop()}</p>
            )}
            <input type="file" onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} className="block w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary" />
          </div>

          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Target cohorts</label>
            {cohorts.length === 0 ? <p className="text-xs text-amber-600">No cohorts available — homework would be hidden from students.</p> : (
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
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl hover:bg-surface-container">Cancel</button>
          <button onClick={save} disabled={saving} className="px-5 py-2.5 text-sm font-bold academic-gradient text-white rounded-xl shadow-md hover:opacity-90 disabled:opacity-60">{saving ? 'Saving…' : editingId ? 'Save' : 'Assign'}</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Delete homework?"
        message="This removes the assignment and all its submissions for every cohort."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </DashboardLayout>
  );
}
