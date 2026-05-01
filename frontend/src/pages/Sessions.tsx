import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { ToastContainer } from '../components/Toast';
import { SkeletonGrid } from '../components/Skeleton';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { navForRole } from '../lib/nav';
import { formatPKT, formatCET, isJoinable } from '../lib/time';
import { notifyStudents } from '../lib/notify';
import { useToast } from '../lib/useToast';
import { qk, fetchSessions, fetchActiveCourses } from '../lib/queries';

interface Session {
  id: string;
  course_id: string;
  title: string;
  scheduled_at: string;
  duration_min: number;
  zoom_link: string;
  status: string;
  summary: string;
  created_at: string;
}

interface Course {
  id: string;
  title: string;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-primary/10 text-primary',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-error-container text-on-error-container',
};

const statusIcons: Record<string, string> = {
  scheduled: 'schedule',
  in_progress: 'play_circle',
  completed: 'check_circle',
  cancelled: 'cancel',
};

export default function Sessions() {
  const { role } = useAppStore();
  const nav = navForRole(role);
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSummary, setEditingSummary] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState('');

  const blankForm = { title: '', course_id: '', scheduled_at: '', duration_min: 60, zoom_link: '', status: 'scheduled' };
  const [form, setForm] = useState(blankForm);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const toast = useToast();

  const { data: sessions = [], isLoading: loading } = useQuery<Session[]>({ queryKey: qk.sessions, queryFn: fetchSessions });
  const { data: courses = [] } = useQuery<Course[]>({ queryKey: qk.coursesActive, queryFn: fetchActiveCourses });
  const refetch = () => qc.invalidateQueries({ queryKey: qk.sessions });

  const openCreate = () => { setEditingId(null); setForm(blankForm); setShowCreateModal(true); };
  const openEdit = (s: Session) => {
    setEditingId(s.id);
    setForm({
      title: s.title,
      course_id: s.course_id,
      scheduled_at: s.scheduled_at ? new Date(s.scheduled_at).toISOString().slice(0, 16) : '',
      duration_min: s.duration_min,
      zoom_link: s.zoom_link || '',
      status: s.status,
    });
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const courseTitle = courses.find(c => c.id === form.course_id)?.title || 'a course';

    if (editingId) {
      const { error } = await supabase.from('sessions').update(form).eq('id', editingId);
      if (!error) {
        await notifyStudents('session_updated', 'Session updated', `${form.title} (${courseTitle}) has been rescheduled.`, editingId);
      }
    } else {
      const { data, error } = await supabase.from('sessions').insert({ ...form, created_by: user.id }).select().single();
      if (!error && data) {
        await notifyStudents('session_new', 'New session scheduled', `${form.title} — ${courseTitle}`, data.id);
      }
    }
    setShowCreateModal(false);
    setEditingId(null);
    setForm(blankForm);
    refetch();
  };

  const handleStatusChange = async (id: string, newStatus: string, courseId: string) => {
    const session = sessions.find(s => s.id === id);
    await supabase.from('sessions').update({ status: newStatus }).eq('id', id);
    if (newStatus === 'completed') {
      const { error: rpcErr } = await supabase.rpc('increment_completed_lectures', { course_id_param: courseId });
      if (rpcErr) {
        const { data } = await supabase.from('courses').select('completed_lectures').eq('id', courseId).single();
        if (data) await supabase.from('courses').update({ completed_lectures: data.completed_lectures + 1 }).eq('id', courseId);
      }
    } else if (newStatus === 'cancelled' && session) {
      await notifyStudents('session_cancelled', 'Session cancelled', `${session.title} has been cancelled.`, id);
    }
    refetch();
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    await supabase.from('sessions').delete().eq('id', id);
    toast.success('Session deleted');
    refetch();
  };

  const handleSaveSummary = async (id: string) => {
    const session = sessions.find(s => s.id === id);
    await supabase.from('sessions').update({ summary: summaryText }).eq('id', id);
    if (session) {
      await notifyStudents('session_summary', 'Session summary posted', `${session.title}`, id);
    }
    setEditingSummary(null);
    setSummaryText('');
    refetch();
  };

  const filtered = statusFilter === 'all' ? sessions : sessions.filter(s => s.status === statusFilter);
  const getCourseName = (id: string) => courses.find(c => c.id === id)?.title || '—';

  return (
    <DashboardLayout title="Sessions" navItems={nav}>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-primary tracking-tight">Session Management</h2>
            <p className="text-on-surface-variant text-sm mt-1">{filtered.length} session{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          {role === 'teacher' && (
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
              Schedule Session
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap gap-1 bg-surface-container rounded-xl p-1 w-fit">
          {['all', 'scheduled', 'in_progress', 'completed', 'cancelled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3.5 py-2 text-[0.65rem] font-bold uppercase tracking-widest rounded-lg transition-all ${statusFilter === s ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >{s.replace('_', ' ')}</button>
          ))}
        </div>

        {/* Sessions List */}
        {loading ? (
          <SkeletonGrid count={4} variant="row" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">event</span>
            <p className="text-on-surface-variant font-medium">No sessions found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(s => (
              <div key={s.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden hover-lift hover:border-outline-variant/25">
                <div className="p-5 flex flex-col md:flex-row gap-5">
                  {/* Left info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6rem] font-bold uppercase tracking-widest ${statusColors[s.status] || 'bg-surface-container text-secondary'}`}>
                        <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>{statusIcons[s.status] || 'help'}</span>
                        {s.status.replace('_', ' ')}
                      </span>
                      <span className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50">{getCourseName(s.course_id)}</span>
                    </div>
                    <h3 className="font-bold text-on-surface text-base">{s.title}</h3>
                    <div className="grid sm:grid-cols-2 gap-2 mt-1">
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                        <span className="material-symbols-outlined text-primary/70" style={{ fontSize: '0.9rem' }}>schedule</span>
                        <span className="font-bold text-primary/80">{formatPKT(s.scheduled_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                        <span className="material-symbols-outlined text-secondary/70" style={{ fontSize: '0.9rem' }}>public</span>
                        <span className="font-bold text-secondary">{formatCET(s.scheduled_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-on-surface-variant font-medium pt-1">
                      <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>timer</span>
                      {s.duration_min} min
                    </div>
                  </div>

                  {/* Right actions */}
                  <div className="flex flex-wrap items-start gap-2 shrink-0">
                    {s.zoom_link && (role === 'teacher' || isJoinable(s.scheduled_at, s.duration_min)) && (
                      <a href={s.zoom_link} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary text-xs font-bold rounded-xl hover:bg-primary/20 transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>video_call</span>
                        Join Zoom
                      </a>
                    )}
                    {role === 'student' && s.zoom_link && !isJoinable(s.scheduled_at, s.duration_min) && s.status === 'scheduled' && (
                      <span className="px-3 py-2 bg-surface-container text-secondary text-[0.65rem] font-bold uppercase tracking-widest rounded-xl">
                        Opens 15 min before
                      </span>
                    )}
                    {role === 'teacher' && s.status === 'scheduled' && (
                      <>
                        <button onClick={() => handleStatusChange(s.id, 'completed', s.course_id)}
                          className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-xl hover:bg-emerald-100 transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check_circle</span>
                          Complete
                        </button>
                        <button onClick={() => handleStatusChange(s.id, 'cancelled', s.course_id)}
                          className="flex items-center gap-2 px-3 py-2.5 bg-error-container text-on-error-container text-xs font-bold rounded-xl hover:opacity-90 transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>cancel</span>
                          Cancel
                        </button>
                      </>
                    )}
                    {role === 'teacher' && (
                      <>
                        <button onClick={() => openEdit(s)} title="Edit"
                          className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container text-secondary transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>edit</span>
                        </button>
                        <button onClick={() => handleDelete(s.id)} title="Delete"
                          className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-error-container/30 text-error transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>delete</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Summary section */}
                {(s.summary || (role === 'teacher' && s.status === 'completed')) && (
                  <div className="border-t border-outline-variant/10 px-5 py-4 bg-surface-container-low/30">
                    {editingSummary === s.id ? (
                      <div className="space-y-3">
                        <textarea className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface resize-none h-24" placeholder="Write what was covered…" value={summaryText} onChange={e => setSummaryText(e.target.value)} />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingSummary(null)} className="px-4 py-2 text-xs font-bold text-on-surface-variant rounded-lg">Cancel</button>
                          <button onClick={() => handleSaveSummary(s.id)} className="px-4 py-2 text-xs font-bold academic-gradient text-white rounded-lg">Save</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50 mb-1">Session Summary</p>
                          <p className="text-sm text-on-surface leading-relaxed">{s.summary || <span className="italic text-on-surface-variant">No summary yet.</span>}</p>
                        </div>
                        {role === 'teacher' && (
                          <button onClick={() => { setEditingSummary(s.id); setSummaryText(s.summary || ''); }}
                            className="shrink-0 text-xs font-bold text-primary hover:underline">
                            {s.summary ? 'Edit' : 'Add Summary'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Session Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title={editingId ? 'Edit Session' : 'Schedule New Session'} maxWidth="lg">
        <div className="space-y-4">
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Title</label>
                <input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="e.g. Chapter 3: Arrays" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Course</label>
                  <select className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.course_id} onChange={e => setForm(p => ({ ...p, course_id: e.target.value }))}>
                    <option value="">Select…</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Duration (min)</label>
                  <input type="number" min={15} className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.duration_min} onChange={e => setForm(p => ({ ...p, duration_min: +e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Date & Time</label>
                <input type="datetime-local" className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Zoom Link</label>
                <input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="https://zoom.us/j/..." value={form.zoom_link} onChange={e => setForm(p => ({ ...p, zoom_link: e.target.value }))} />
              </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl hover:bg-surface-container press-shrink">Cancel</button>
          <button onClick={handleCreate} disabled={!form.title || !form.course_id} className="px-5 py-2.5 text-sm font-bold academic-gradient text-white rounded-xl shadow-md hover:opacity-90 press-shrink disabled:opacity-50">{editingId ? 'Save' : 'Schedule'}</button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Delete session?"
        message="This permanently removes the session. Students will lose access to the Zoom link and summary."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </DashboardLayout>
  );
}
