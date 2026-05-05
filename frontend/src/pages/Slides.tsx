import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { ToastContainer } from '../components/Toast';
import { SkeletonGrid } from '../components/Skeleton';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { navForRole } from '../lib/nav';
import { notifyStudents } from '../lib/notify';
import { useToast } from '../lib/useToast';
import { qk, fetchSlides, fetchCourses } from '../lib/queries';

interface Slide {
  id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  file_path: string;
  created_at: string;
}

interface Course {
  id: string;
  title: string;
}

export default function Slides() {
  const { role } = useAppStore();
  const nav = navForRole(role);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ title: '', description: '', course_id: '' });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; filePath: string } | null>(null);
  const toast = useToast();

  const { data: slides = [], isLoading } = useQuery<Slide[]>({ queryKey: qk.slides, queryFn: fetchSlides });
  const { data: courses = [] } = useQuery<Course[]>({ queryKey: qk.courses, queryFn: fetchCourses });
  const refetch = () => qc.invalidateQueries({ queryKey: qk.slides });

  const pickFile = (f: File | null) => {
    if (!f) { setFile(null); return; }
    const ok = f.name.toLowerCase().endsWith('.html') || f.name.toLowerCase().endsWith('.htm');
    if (!ok) { toast.error('Only .html files', 'Slide decks must be a single self-contained HTML file.'); return; }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file || !form.title) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const path = `${user.id}/${Date.now()}.html`;
    const { error: uploadErr } = await supabase.storage
      .from('slides')
      .upload(path, file, { contentType: 'text/html; charset=utf-8' });
    if (uploadErr) { toast.error('Upload failed', uploadErr.message); setUploading(false); return; }

    const { data, error: insertErr } = await supabase.from('slides').insert({
      title: form.title,
      description: form.description || null,
      course_id: form.course_id || null,
      file_path: path,
      uploaded_by: user.id,
    }).select().single();

    if (!insertErr && data) {
      await notifyStudents('slide', 'New slide deck available', `"${form.title}" was added.`, data.id);
      toast.success('Slide deck uploaded');
    } else if (insertErr) {
      toast.error('Save failed', insertErr.message);
    }

    setShowUpload(false);
    setForm({ title: '', description: '', course_id: '' });
    setFile(null);
    setUploading(false);
    refetch();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id, filePath } = pendingDelete;
    setPendingDelete(null);
    await supabase.storage.from('slides').remove([filePath]);
    await supabase.from('slides').delete().eq('id', id);
    toast.success('Slide deck deleted');
    refetch();
  };

  const getCourseName = (id: string | null) => id ? (courses.find(c => c.id === id)?.title || '—') : 'General';
  const viewerBase = role === 'teacher' ? '/teacher/slides' : '/student/slides';

  return (
    <DashboardLayout title="Slides" navItems={nav}>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-primary tracking-tight">Animated Slide Decks</h2>
            <p className="text-on-surface-variant text-sm mt-1">{slides.length} deck{slides.length !== 1 ? 's' : ''}</p>
          </div>
          {role === 'teacher' && (
            <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-4 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
              Upload Deck
            </button>
          )}
        </div>

        {isLoading ? (
          <SkeletonGrid count={6} variant="card" />
        ) : slides.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">slideshow</span>
            <p className="text-on-surface-variant font-medium">No slide decks yet.</p>
            {role === 'teacher' && (
              <p className="text-on-surface-variant/70 text-sm mt-2">Upload a self-contained .html file to get started.</p>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {slides.map(s => (
              <div key={s.id} className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 hover-lift flex flex-col">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>slideshow</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-on-surface text-sm truncate">{s.title}</h3>
                    <p className="text-[0.65rem] font-bold uppercase tracking-widest text-secondary/50 mt-0.5">{getCourseName(s.course_id)}</p>
                  </div>
                </div>
                {s.description && (
                  <p className="text-xs text-on-surface-variant line-clamp-2 mb-4">{s.description}</p>
                )}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-outline-variant/10">
                  <button
                    onClick={() => navigate(`${viewerBase}/${s.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>play_arrow</span>
                    View
                  </button>
                  {role === 'teacher' && (
                    <button onClick={() => setPendingDelete({ id: s.id, filePath: s.file_path })} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-error-container/30 transition-colors text-error">
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>delete</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Upload Slide Deck" maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Title</label>
            <input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="Deck title…" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Description (optional)</label>
            <textarea rows={2} className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface resize-none" placeholder="One-line summary of what this deck explains…" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Course (optional)</label>
            <select className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.course_id} onChange={e => setForm(p => ({ ...p, course_id: e.target.value }))}>
              <option value="">— None / General —</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">HTML file</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-outline-variant/40 rounded-xl px-4 py-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
            >
              <span className="material-symbols-outlined text-3xl text-outline/40 mb-2 block">cloud_upload</span>
              <p className="text-sm text-on-surface-variant font-medium">{file ? file.name : 'Click to choose an .html file'}</p>
              <p className="text-[0.6rem] text-secondary mt-1">Single self-contained HTML — animations, scripts, and styles inlined.</p>
            </div>
            <input ref={fileRef} type="file" className="hidden" accept=".html,.htm,text/html" onChange={e => pickFile(e.target.files?.[0] || null)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={() => setShowUpload(false)} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl hover:bg-surface-container press-shrink">Cancel</button>
          <button onClick={handleUpload} disabled={!form.title || !file || uploading} className="px-5 py-2.5 text-sm font-bold academic-gradient text-white rounded-xl shadow-md hover:opacity-90 press-shrink disabled:opacity-50">
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete slide deck?"
        message="This permanently removes the file and its record. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </DashboardLayout>
  );
}
