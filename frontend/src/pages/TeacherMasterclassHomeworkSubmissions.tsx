import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../lib/useToast';
import { teacherNav } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { formatLocal } from '../lib/time';
import { type MasterclassHomework, type HomeworkSubmission } from '../lib/masterclass';

interface Profile { id: string; full_name: string | null; email: string | null; avatar_url: string | null }

export default function TeacherMasterclassHomeworkSubmissions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [hw, setHw] = useState<MasterclassHomework | null>(null);
  const [subs, setSubs] = useState<HomeworkSubmission[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<Record<string, { score: string; feedback: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: h } = await supabase.from('masterclass_homework').select('*').eq('id', id).single();
    const { data: s } = await supabase.from('masterclass_homework_submissions').select('*').eq('homework_id', id).order('submitted_at');
    const subsArr = (s as HomeworkSubmission[]) ?? [];
    setHw((h as MasterclassHomework) ?? null);
    setSubs(subsArr);
    const ids = [...new Set(subsArr.map((x) => x.user_id))];
    if (ids.length) {
      const { data: p } = await supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', ids);
      const map: Record<string, Profile> = {};
      (p as Profile[] ?? []).forEach((pr) => { map[pr.id] = pr; });
      setProfiles(map);
    }
    const g: Record<string, { score: string; feedback: string }> = {};
    subsArr.forEach((sub) => { g[sub.id] = { score: sub.score?.toString() ?? '', feedback: sub.feedback ?? '' }; });
    setGrades(g);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage.from('masterclass-submissions').download(path);
    if (error || !data) { toast.error('Download failed'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = path.split('/').pop() || 'submission'; a.click();
    URL.revokeObjectURL(url);
  };

  const saveGrade = async (sub: HomeworkSubmission) => {
    const g = grades[sub.id];
    setSavingId(sub.id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('masterclass_homework_submissions').update({
      score: hw?.points != null && g.score !== '' ? Number(g.score) : null,
      feedback: g.feedback || null,
      status: 'graded',
      graded_at: new Date().toISOString(),
      graded_by: user?.id,
    }).eq('id', sub.id);
    setSavingId(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Returned to student');
    load();
  };

  const initials = (p?: Profile) => p?.full_name ? p.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '?';

  if (loading) return <DashboardLayout title="Submissions" navItems={teacherNav}><div className="max-w-3xl mx-auto h-80 rounded-2xl bg-surface-container/40 animate-pulse" /></DashboardLayout>;
  if (!hw) return <DashboardLayout title="Submissions" navItems={teacherNav}><div className="max-w-3xl mx-auto text-center py-20"><p className="text-on-surface-variant">Homework not found.</p><button onClick={() => navigate('/teacher/masterclass/homework')} className="mt-4 text-sm font-bold text-primary hover:underline">← Back</button></div></DashboardLayout>;

  return (
    <DashboardLayout title="Submissions" navItems={teacherNav}>
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => navigate('/teacher/masterclass/homework')} className="inline-flex items-center gap-1 text-sm font-bold text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_back</span>Homework
        </button>

        <div>
          <h2 className="text-2xl font-extrabold text-primary tracking-tight">{hw.title}</h2>
          <p className="text-on-surface-variant text-sm mt-1">
            {subs.length} submission{subs.length === 1 ? '' : 's'}{hw.points != null ? ` · out of ${hw.points} pts` : ' · review only'}
          </p>
        </div>

        {subs.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">inbox</span>
            <p className="text-on-surface-variant font-medium">No submissions yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {subs.map((sub) => {
              const p = profiles[sub.user_id];
              const g = grades[sub.id] ?? { score: '', feedback: '' };
              return (
                <div key={sub.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    {p?.avatar_url ? (
                      <img src={p.avatar_url} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl academic-gradient flex items-center justify-center text-white text-sm font-bold">{initials(p)}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-on-surface truncate">{p?.full_name || p?.email || 'Student'}</p>
                      <p className="text-[0.65rem] text-on-surface-variant">Submitted {formatLocal(sub.submitted_at, 'MMM d, h:mm a')}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-widest ${sub.status === 'submitted' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-600'}`}>
                      {sub.status === 'submitted' ? 'Needs review' : 'Graded'}
                    </span>
                  </div>

                  {sub.text && (
                    <div className="bg-surface-variant/30 rounded-xl px-4 py-3">
                      <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">{sub.text}</p>
                    </div>
                  )}
                  {sub.file_path && (
                    <button onClick={() => downloadFile(sub.file_path!)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary text-sm font-bold rounded-xl hover:bg-primary/20">
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>download</span>{sub.file_path.split('/').pop()}
                    </button>
                  )}

                  {/* Grade controls */}
                  <div className="border-t border-outline-variant/10 pt-4 grid gap-3 sm:grid-cols-[auto_1fr]">
                    {hw.points != null && (
                      <div>
                        <label className="block text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Score</label>
                        <div className="flex items-center gap-1.5">
                          <input type="number" min={0} max={hw.points} value={g.score} onChange={(e) => setGrades((prev) => ({ ...prev, [sub.id]: { ...g, score: e.target.value } }))} className="w-20 px-3 py-2.5 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" />
                          <span className="text-sm text-on-surface-variant">/ {hw.points}</span>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Feedback</label>
                      <textarea value={g.feedback} onChange={(e) => setGrades((prev) => ({ ...prev, [sub.id]: { ...g, feedback: e.target.value } }))} className="w-full px-4 py-2.5 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface resize-none h-16" placeholder="Comments for the student…" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={() => saveGrade(sub)} disabled={savingId === sub.id} className="px-5 py-2.5 text-sm font-bold academic-gradient text-white rounded-xl shadow-md hover:opacity-90 disabled:opacity-60">
                      {savingId === sub.id ? 'Saving…' : sub.status === 'submitted' ? 'Return to student' : 'Update grade'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </DashboardLayout>
  );
}
