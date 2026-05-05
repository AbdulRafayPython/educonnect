import { useState, useRef } from 'react';
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
import { qk, fetchDocuments, fetchCourses } from '../lib/queries';

const tagColors: Record<string, string> = {
  notes: 'bg-primary/10 text-primary',
  reference: 'bg-secondary/10 text-secondary',
  assignment: 'bg-amber-100 text-amber-700',
  other: 'bg-surface-container text-on-surface-variant',
};

const tagIcons: Record<string, string> = {
  notes: 'sticky_note_2',
  reference: 'menu_book',
  assignment: 'assignment',
  other: 'attach_file',
};

interface Doc {
  id: string;
  course_id: string;
  title: string;
  file_path: string;
  file_type: string;
  tag: string;
  created_at: string;
}

interface Course {
  id: string;
  title: string;
}

export default function Documents() {
  const { role } = useAppStore();
  const nav = navForRole(role);
  const qc = useQueryClient();
  const [tagFilter, setTagFilter] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ title: '', course_id: '', tag: 'notes' });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; filePath: string } | null>(null);
  const toast = useToast();

  const { data: docs = [], isLoading: docsLoading } = useQuery<Doc[]>({ queryKey: qk.documents, queryFn: fetchDocuments });
  const { data: courses = [] } = useQuery<Course[]>({ queryKey: qk.courses, queryFn: fetchCourses });
  const loading = docsLoading;
  const refetch = () => qc.invalidateQueries({ queryKey: qk.documents });

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file);
    if (uploadErr) { toast.error('Upload failed', uploadErr.message); setUploading(false); return; }

    const { data, error: insertErr } = await supabase.from('documents').insert({
      ...form,
      file_path: path,
      file_type: ext || '',
      uploaded_by: user.id,
    }).select().single();

    if (!insertErr && data) {
      const courseTitle = courses.find(c => c.id === form.course_id)?.title || 'a course';
      await notifyStudents('document', 'New document available', `"${form.title}" was added to ${courseTitle}.`, data.id);
    }

    setShowUpload(false);
    setForm({ title: '', course_id: '', tag: 'notes' });
    setFile(null);
    setUploading(false);
    refetch();
  };

  const handleDownload = async (filePath: string, title: string) => {
    const { data, error } = await supabase.storage.from('documents').download(filePath);
    if (error || !data) { toast.error('Download failed', error?.message || 'Could not fetch file.'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filePath.split('/').pop() || title;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (id: string, filePath: string) => {
    setPendingDelete({ id, filePath });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id, filePath } = pendingDelete;
    setPendingDelete(null);
    await supabase.storage.from('documents').remove([filePath]);
    await supabase.from('documents').delete().eq('id', id);
    toast.success('Document deleted');
    refetch();
  };

  const filtered = tagFilter === 'all' ? docs : docs.filter(d => d.tag === tagFilter);
  const getCourseName = (id: string) => courses.find(c => c.id === id)?.title || '—';

  return (
    <DashboardLayout title="Documents" navItems={nav}>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-primary tracking-tight">Document Vault</h2>
            <p className="text-on-surface-variant text-sm mt-1">{filtered.length} document{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          {role === 'teacher' && (
            <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-4 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>file_upload</span>
              Upload Document
            </button>
          )}
        </div>

        {/* Tag Filter */}
        <div className="flex flex-wrap gap-1 bg-surface-container rounded-xl p-1 w-fit">
          {['all', 'notes', 'reference', 'assignment', 'other'].map(t => (
            <button key={t} onClick={() => setTagFilter(t)}
              className={`px-3.5 py-2 text-[0.65rem] font-bold uppercase tracking-widest rounded-lg transition-all ${tagFilter === t ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >{t}</button>
          ))}
        </div>

        {/* Document Grid */}
        {loading ? (
          <SkeletonGrid count={6} variant="card" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">description</span>
            <p className="text-on-surface-variant font-medium">No documents yet.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(d => (
              <div key={d.id} className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 hover-lift flex flex-col">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tagColors[d.tag] || tagColors.other}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>{tagIcons[d.tag] || 'attach_file'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-on-surface text-sm truncate">{d.title}</h3>
                    <p className="text-[0.65rem] font-bold uppercase tracking-widest text-secondary/50 mt-0.5">{getCourseName(d.course_id)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-outline-variant/10">
                  <div className="flex items-center gap-2">
                    <span className={`text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${tagColors[d.tag] || tagColors.other}`}>{d.tag}</span>
                    <span className="text-[0.6rem] text-on-surface-variant">{d.file_type?.toUpperCase()}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleDownload(d.file_path, d.title)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container transition-colors text-primary">
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>download</span>
                    </button>
                    {role === 'teacher' && (
                      <button onClick={() => handleDelete(d.id, d.file_path)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-error-container/30 transition-colors text-error">
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Upload Document" maxWidth="md">
        <div className="space-y-4">
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Title</label>
                <input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="Document name…" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
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
                  <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Tag</label>
                  <select className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.tag} onChange={e => setForm(p => ({ ...p, tag: e.target.value }))}>
                    <option value="notes">Lecture Notes</option>
                    <option value="reference">Reference</option>
                    <option value="assignment">Assignment</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">File</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-outline-variant/40 rounded-xl px-4 py-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <span className="material-symbols-outlined text-3xl text-outline/40 mb-2 block">cloud_upload</span>
                  <p className="text-sm text-on-surface-variant font-medium">{file ? file.name : 'Click to choose a file'}</p>
                  <p className="text-[0.6rem] text-secondary mt-1">PDF, DOCX, PPTX, images — max 50 MB</p>
                </div>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] || null)} />
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
        title="Delete document?"
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
