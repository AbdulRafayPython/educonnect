import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { ToastContainer } from '../components/Toast';
import { SkeletonGrid } from '../components/Skeleton';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { format, formatDistanceToNow } from 'date-fns';
import { navForRole } from '../lib/nav';
import { notifyStudents, notifyTeachers } from '../lib/notify';
import { useToast } from '../lib/useToast';
import { qk, fetchQuizzes, fetchCourses } from '../lib/queries';

interface Quiz {
  id: string;
  course_id: string;
  title: string;
  description: string;
  file_path: string;
  type: string;
  due_date: string;
  status: string;
  submission_path: string;
  submitted_by: string | null;
  submitted_at: string | null;
  submitted_filename: string | null;
  grade: string;
  feedback: string;
  created_at: string;
}

interface Course { id: string; title: string; }
interface Submitter { id: string; full_name: string | null; email: string | null; avatar_url: string | null; }

const typeColors: Record<string, string> = {
  quiz: 'bg-primary/10 text-primary',
  challenge: 'bg-amber-100 text-amber-700',
  assignment: 'bg-secondary/10 text-secondary',
};

export default function Quizzes() {
  const { role } = useAppStore();
  const nav = navForRole(role);
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeForm, setGradeForm] = useState({ grade: '', feedback: '' });
  const [pendingDelete, setPendingDelete] = useState<Quiz | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const submissionRef = useRef<HTMLInputElement>(null);

  const blankForm = { title: '', description: '', course_id: '', type: 'quiz', due_date: '' };
  const [form, setForm] = useState(blankForm);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const toast = useToast();

  const { data: quizzes = [], isLoading: loading } = useQuery<Quiz[]>({ queryKey: qk.quizzes, queryFn: fetchQuizzes });
  const { data: courses = [] } = useQuery<Course[]>({ queryKey: qk.courses, queryFn: fetchCourses });
  const refetch = () => qc.invalidateQueries({ queryKey: qk.quizzes });

  const submitterIds = Array.from(new Set(quizzes.map(q => q.submitted_by).filter(Boolean))) as string[];
  const { data: submitters = [] } = useQuery<Submitter[]>({
    queryKey: ['quiz-submitters', submitterIds.sort().join(',')],
    queryFn: async () => {
      if (submitterIds.length === 0) return [];
      const { data } = await supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', submitterIds);
      return (data || []) as Submitter[];
    },
    enabled: submitterIds.length > 0,
  });
  const submitterById = (id: string | null) => id ? submitters.find(s => s.id === id) : undefined;
  const submitterInitials = (s?: Submitter) => {
    if (!s?.full_name) return '??';
    return s.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(blankForm);
    setFile(null);
    setShowCreate(true);
  };

  const openEdit = (q: Quiz) => {
    setEditingId(q.id);
    setForm({
      title: q.title,
      description: q.description || '',
      course_id: q.course_id,
      type: q.type,
      due_date: q.due_date ? q.due_date.slice(0, 10) : '',
    });
    setFile(null);
    setShowCreate(true);
  };

  const handleSave = async () => {
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    let filePath: string | undefined;
    if (file) {
      const ext = file.name.split('.').pop();
      filePath = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('documents').upload(filePath, file);
      if (upErr) { toast.error('File upload failed', upErr.message); setUploading(false); return; }
    }

    const courseTitle = courses.find(c => c.id === form.course_id)?.title || 'a course';

    if (editingId) {
      const existing = quizzes.find(q => q.id === editingId);
      const updatePayload: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        course_id: form.course_id,
        type: form.type,
        due_date: form.due_date || null,
      };
      if (filePath) {
        updatePayload.file_path = filePath;
        if (existing?.file_path) await supabase.storage.from('documents').remove([existing.file_path]);
      }
      const { error } = await supabase.from('quizzes').update(updatePayload).eq('id', editingId);
      if (error) {
        toast.error('Update failed', error.message);
      } else {
        await notifyStudents('quiz', `${form.type} updated`, `"${form.title}" — ${courseTitle}`, editingId);
        toast.success('Quiz updated');
      }
    } else {
      const insertPayload = {
        ...form,
        due_date: form.due_date || null,
        file_path: filePath || '',
        created_by: user.id,
      };
      const { data, error } = await supabase.from('quizzes').insert(insertPayload).select().single();
      if (error) {
        toast.error('Create failed', error.message);
      } else if (data) {
        await notifyStudents('quiz', `New ${form.type} posted`, `"${form.title}" — ${courseTitle}`, data.id);
        toast.success('Quiz created');
      }
    }

    setShowCreate(false);
    setEditingId(null);
    setForm(blankForm);
    setFile(null);
    setUploading(false);
    refetch();
  };

  const handleDelete = (q: Quiz) => {
    setPendingDelete(q);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const q = pendingDelete;
    setPendingDelete(null);
    if (q.file_path) await supabase.storage.from('documents').remove([q.file_path]);
    if (q.submission_path) await supabase.storage.from('quiz-submissions').remove([q.submission_path]);
    const { error } = await supabase.from('quizzes').delete().eq('id', q.id);
    if (error) {
      toast.error('Delete failed', error.message);
    } else {
      toast.success('Quiz deleted');
    }
    refetch();
  };

  const handleSubmission = async (quizId: string, file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from('quiz-submissions').upload(path, file);
    if (uploadErr) { toast.error('Upload failed', uploadErr.message); return; }
    const { error: updateErr } = await supabase.from('quizzes').update({
      submission_path: path,
      submitted_by: user.id,
      submitted_at: new Date().toISOString(),
      submitted_filename: file.name,
      status: 'submitted',
    }).eq('id', quizId);
    if (updateErr) { toast.error('Submission failed', updateErr.message); return; }
    const quiz = quizzes.find(q => q.id === quizId);
    if (quiz) {
      await notifyTeachers('submission', 'Quiz submitted', `Student submitted "${quiz.title}".`, quizId);
      toast.success('Submission uploaded', `"${file.name}" sent to teacher.`);
    }
    refetch();
  };

  const downloadSubmission = async (q: Quiz) => {
    if (!q.submission_path) return;
    const { data, error } = await supabase.storage.from('quiz-submissions').download(q.submission_path);
    if (error || !data) { toast.error('Download failed', error?.message || 'Could not fetch file.'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = q.submitted_filename || q.submission_path.split('/').pop() || `submission-${q.title}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };


  const handleGrade = async (quizId: string) => {
    await supabase.from('quizzes').update({ ...gradeForm, status: 'graded' }).eq('id', quizId);
    const quiz = quizzes.find(q => q.id === quizId);
    if (quiz) {
      await notifyStudents('grade', 'Quiz graded', `"${quiz.title}" — Grade: ${gradeForm.grade}`, quizId);
    }
    setGradingId(null);
    setGradeForm({ grade: '', feedback: '' });
    refetch();
  };

  const filtered = typeFilter === 'all' ? quizzes : quizzes.filter(q => q.type === typeFilter);
  const getCourseName = (id: string) => courses.find(c => c.id === id)?.title || '—';

  const statusBadge = (s: string) => {
    const m: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      submitted: 'bg-primary/10 text-primary',
      graded: 'bg-emerald-50 text-emerald-600',
    };
    return m[s] || 'bg-surface-container text-secondary';
  };

  return (
    <DashboardLayout title="Quizzes & Challenges" navItems={nav}>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-primary tracking-tight">Quizzes & Challenges</h2>
            <p className="text-on-surface-variant text-sm mt-1">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          {role === 'teacher' && (
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
              Create Quiz
            </button>
          )}
        </div>

        {/* Type Filter */}
        <div className="flex flex-wrap gap-1 bg-surface-container rounded-xl p-1 w-fit">
          {['all', 'quiz', 'challenge', 'assignment'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3.5 py-2 text-[0.65rem] font-bold uppercase tracking-widest rounded-lg transition-all ${typeFilter === t ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >{t}</button>
          ))}
        </div>

        {/* Quiz List */}
        {loading ? (
          <SkeletonGrid count={4} variant="row" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">quiz</span>
            <p className="text-on-surface-variant font-medium">No quizzes yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(q => (
              <div key={q.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden hover-lift">
                <div className="p-5 flex flex-col sm:flex-row gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeColors[q.type] || typeColors.quiz}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>
                      {q.type === 'quiz' ? 'quiz' : q.type === 'challenge' ? 'emoji_events' : 'assignment'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${typeColors[q.type]}`}>{q.type}</span>
                      <span className={`text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${statusBadge(q.status)}`}>{q.status}</span>
                    </div>
                    <h3 className="font-bold text-on-surface">{q.title}</h3>
                    <p className="text-xs text-on-surface-variant">{q.description || 'No description'}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-on-surface-variant font-medium mt-1">
                      <span className="flex items-center gap-1 text-secondary/60"><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>school</span>{getCourseName(q.course_id)}</span>
                      {q.due_date && (
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>event</span>Due {format(new Date(q.due_date), 'MMM d, yyyy')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-row sm:flex-col flex-wrap gap-2 shrink-0 sm:items-end">
                    {q.file_path && (
                      <button onClick={async () => {
                        const { data, error } = await supabase.storage.from('documents').download(q.file_path);
                        if (error || !data) { toast.error('Download failed', error?.message || 'Could not fetch file.'); return; }
                        const url = URL.createObjectURL(data);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = q.file_path.split('/').pop() || `${q.title}`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      }} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-primary bg-primary/10 rounded-xl hover:bg-primary/20 transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>download</span>Download
                      </button>
                    )}
                    {role === 'student' && q.status === 'pending' && (
                      <>
                        <button onClick={() => submissionRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white academic-gradient rounded-xl hover:opacity-90 transition-all">
                          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>upload_file</span>Submit
                        </button>
                        <input ref={submissionRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) handleSubmission(q.id, e.target.files[0]); }} />
                      </>
                    )}
                    {role === 'teacher' && (
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(q)} title="Edit"
                          className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container text-secondary transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>edit</span>
                        </button>
                        <button onClick={() => handleDelete(q)} title="Delete"
                          className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-error-container/30 text-error transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submission panel — visible to teacher once a submission exists */}
                {role === 'teacher' && q.submission_path && (q.status === 'submitted' || q.status === 'graded') && (() => {
                  const submitter = submitterById(q.submitted_by);
                  const ext = (q.submitted_filename || q.submission_path).split('.').pop()?.toUpperCase() || 'FILE';
                  const submittedAt = q.submitted_at ? new Date(q.submitted_at) : null;
                  return (
                    <div className="border-t border-outline-variant/10 p-4 sm:p-5 bg-primary/[0.03]">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary" style={{ fontSize: '1.05rem' }}>assignment_turned_in</span>
                          <span className="text-[0.6rem] font-bold uppercase tracking-widest text-primary">Student Submission</span>
                        </div>
                        {q.status === 'submitted' && (
                          <span className="text-[0.55rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Awaiting grade</span>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        {/* Submitter */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          {submitter?.avatar_url ? (
                            <img src={submitter.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl academic-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {submitterInitials(submitter)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-on-surface truncate">{submitter?.full_name || 'Unknown student'}</p>
                            {submitter?.email && (
                              <p className="text-[0.65rem] text-on-surface-variant truncate">{submitter.email}</p>
                            )}
                          </div>
                        </div>

                        <div className="hidden sm:block w-px h-10 bg-outline-variant/30" />

                        {/* File chip */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl bg-surface-container-highest text-on-surface-variant flex items-center justify-center shrink-0 relative">
                            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>description</span>
                            <span className="absolute -bottom-1 -right-1 text-[0.5rem] font-extrabold px-1 py-px rounded-md bg-primary text-on-primary leading-none">
                              {ext.length > 4 ? ext.slice(0, 4) : ext}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-on-surface truncate">{q.submitted_filename || q.submission_path.split('/').pop()}</p>
                            <p className="text-[0.65rem] text-on-surface-variant">
                              {submittedAt ? (
                                <>
                                  Submitted {formatDistanceToNow(submittedAt, { addSuffix: true })}
                                  <span className="hidden sm:inline"> · {format(submittedAt, 'MMM d, yyyy h:mm a')}</span>
                                </>
                              ) : 'Submitted'}
                            </p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => downloadSubmission(q)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-primary bg-primary/10 rounded-xl hover:bg-primary/20 transition-colors press-shrink"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>download</span>
                            Download
                          </button>
                          {q.status === 'submitted' && gradingId !== q.id && (
                            <button
                              onClick={() => { setGradingId(q.id); setGradeForm({ grade: q.grade || '', feedback: q.feedback || '' }); }}
                              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white academic-gradient rounded-xl hover:opacity-90 transition-all press-shrink"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>grading</span>
                              Grade
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Student-facing submission confirmation */}
                {role === 'student' && q.submission_path && (q.status === 'submitted' || q.status === 'graded') && (() => {
                  const ext = (q.submitted_filename || q.submission_path).split('.').pop()?.toUpperCase() || 'FILE';
                  const submittedAt = q.submitted_at ? new Date(q.submitted_at) : null;
                  return (
                    <div className="border-t border-outline-variant/10 p-4 sm:p-5 bg-emerald-50/40">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-emerald-700" style={{ fontSize: '1.05rem' }}>check_circle</span>
                        <span className="text-[0.6rem] font-bold uppercase tracking-widest text-emerald-700">Your submission</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white text-on-surface-variant flex items-center justify-center shrink-0 relative border border-outline-variant/20">
                          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>description</span>
                          <span className="absolute -bottom-1 -right-1 text-[0.5rem] font-extrabold px-1 py-px rounded-md bg-emerald-600 text-white leading-none">
                            {ext.length > 4 ? ext.slice(0, 4) : ext}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-on-surface truncate">{q.submitted_filename || q.submission_path.split('/').pop()}</p>
                          <p className="text-[0.65rem] text-on-surface-variant">
                            {submittedAt ? `Submitted ${formatDistanceToNow(submittedAt, { addSuffix: true })}` : 'Submitted'}
                          </p>
                        </div>
                        <button
                          onClick={() => downloadSubmission(q)}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 bg-white rounded-xl hover:bg-emerald-50 transition-colors press-shrink shrink-0 border border-outline-variant/20"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>download</span>
                          <span className="hidden sm:inline">Download</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Grading section */}
                {gradingId === q.id && (
                  <div className="border-t border-outline-variant/10 p-4 sm:p-5 bg-surface-container-low/30 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Grade</label>
                        <input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="e.g. A, 85%" value={gradeForm.grade} onChange={e => setGradeForm(p => ({ ...p, grade: e.target.value }))} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Feedback</label>
                        <input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="Feedback for student…" value={gradeForm.feedback} onChange={e => setGradeForm(p => ({ ...p, feedback: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setGradingId(null)} className="px-4 py-2 text-xs font-bold text-on-surface-variant">Cancel</button>
                      <button onClick={() => handleGrade(q.id)} className="px-4 py-2 text-xs font-bold academic-gradient text-white rounded-lg">Save Grade</button>
                    </div>
                  </div>
                )}

                {/* Show grade/feedback if graded */}
                {q.status === 'graded' && (
                  <div className="border-t border-outline-variant/10 p-4 sm:p-5 bg-emerald-50/30 flex flex-wrap items-center gap-4 sm:gap-6">
                    <div>
                      <p className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50">Grade</p>
                      <p className="text-lg font-extrabold text-primary">{q.grade}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50">Feedback</p>
                      <p className="text-sm text-on-surface">{q.feedback}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Quiz Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={editingId ? 'Edit Quiz / Challenge' : 'Create Quiz / Challenge'} maxWidth="lg">
        <div className="space-y-4">
              <div><label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Title</label><input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
              <div><label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Description</label><textarea className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface resize-none h-16" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div><label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Course</label><select className="w-full px-3 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.course_id} onChange={e => setForm(p => ({ ...p, course_id: e.target.value }))}><option value="">Select…</option>{courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
                <div><label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Type</label><select className="w-full px-3 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}><option value="quiz">Quiz</option><option value="challenge">Challenge</option><option value="assignment">Assignment</option></select></div>
                <div><label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Due Date</label><input type="date" className="w-full px-3 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
              </div>
              <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-outline-variant/40 rounded-xl px-4 py-6 text-center cursor-pointer hover:border-primary/40 transition-all">
                <span className="material-symbols-outlined text-2xl text-outline/40 block mb-1">cloud_upload</span>
                <p className="text-sm text-on-surface-variant">
                  {file
                    ? file.name
                    : editingId
                      ? 'Replace attached file (optional)'
                      : 'Attach quiz file (optional)'}
                </p>
              </div>
          <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl press-shrink">Cancel</button>
          <button onClick={handleSave} disabled={!form.title || uploading} className="px-5 py-2.5 text-sm font-bold academic-gradient text-white rounded-xl shadow-md press-shrink disabled:opacity-50">
            {uploading ? 'Saving…' : editingId ? 'Save' : 'Create'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete quiz?"
        message={`This permanently removes "${pendingDelete?.title ?? ''}" and any submission. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </DashboardLayout>
  );
}
