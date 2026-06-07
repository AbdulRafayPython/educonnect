import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../lib/useToast';
import { teacherNav } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { formatLocal } from '../lib/time';
import { autoScoreMcq, maxScoreOf, quizTypeMeta, type MasterclassQuiz, type MasterclassSubmission } from '../lib/masterclass';

interface Submitter { id: string; full_name: string | null; email: string | null; avatar_url: string | null }

export default function TeacherMasterclassQuizGrade() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [quiz, setQuiz] = useState<MasterclassQuiz | null>(null);
  const [subs, setSubs] = useState<MasterclassSubmission[]>([]);
  const [people, setPeople] = useState<Record<string, Submitter>>({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Record<string, { score: string; feedback: string }>>({});

  const load = async () => {
    setLoading(true);
    const { data: q } = await supabase.from('masterclass_quizzes').select('*').eq('id', id).single();
    const { data: s } = await supabase.from('masterclass_submissions').select('*').eq('quiz_id', id).order('submitted_at');
    const submissions = (s as MasterclassSubmission[]) ?? [];
    const ids = Array.from(new Set(submissions.map((x) => x.user_id)));
    let map: Record<string, Submitter> = {};
    if (ids.length) {
      const { data: p } = await supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', ids);
      (p as Submitter[] ?? []).forEach((person) => { map[person.id] = person; });
    }
    setQuiz((q as MasterclassQuiz) ?? null);
    setSubs(submissions);
    setPeople(map);
    setDraft(Object.fromEntries(submissions.map((x) => [x.id, { score: x.score != null ? String(x.score) : '', feedback: x.feedback ?? '' }])));
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage.from('masterclass-submissions').download(path);
    if (error || !data) { toast.error('Download failed'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop() || 'submission';
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveGrade = async (sub: MasterclassSubmission) => {
    const d = draft[sub.id];
    if (!d || d.score === '') { toast.error('Enter a score'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('masterclass_submissions').update({
      score: Number(d.score),
      feedback: d.feedback || null,
      graded_at: new Date().toISOString(),
      graded_by: user?.id,
      status: 'graded',
    }).eq('id', sub.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Grade saved');
    load();
  };

  if (loading) return <DashboardLayout title="Grade" navItems={teacherNav}><div className="max-w-3xl mx-auto h-96 rounded-2xl bg-surface-container/40 animate-pulse" /></DashboardLayout>;
  if (!quiz) return <DashboardLayout title="Grade" navItems={teacherNav}><div className="max-w-3xl mx-auto text-center py-20"><p className="text-on-surface-variant">Quiz not found.</p></div></DashboardLayout>;

  const max = maxScoreOf(quiz);

  return (
    <DashboardLayout title="Review submissions" navItems={teacherNav}>
      <div className="max-w-3xl mx-auto space-y-6">
        <button onClick={() => navigate('/teacher/masterclass/quizzes')} className="inline-flex items-center gap-1 text-sm font-bold text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_back</span>Quizzes
        </button>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-widest ${quizTypeMeta[quiz.quiz_type].badge}`}>{quizTypeMeta[quiz.quiz_type].label}</span>
            <span className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50">Week {quiz.week_number} · max {max} pts</span>
          </div>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">{quiz.title}</h2>
          <p className="text-sm text-on-surface-variant mt-1">{subs.length} submission{subs.length !== 1 ? 's' : ''}</p>
        </div>

        {subs.length === 0 ? (
          <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-3 block">inbox</span>
            <p className="text-on-surface-variant font-medium">No submissions yet.</p>
          </div>
        ) : subs.map((sub) => {
          const person = people[sub.user_id];
          const initials = (person?.full_name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
          const auto = quiz.content_type === 'inline' && quiz.questions && sub.answers ? autoScoreMcq(quiz.questions, sub.answers) : null;
          return (
            <div key={sub.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5 space-y-4">
              <div className="flex items-center gap-3">
                {person?.avatar_url ? <img src={person.avatar_url} alt="" className="w-9 h-9 rounded-lg object-cover" /> : <div className="w-9 h-9 rounded-lg academic-gradient flex items-center justify-center text-white text-xs font-bold">{initials}</div>}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-on-surface text-sm truncate">{person?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-on-surface-variant">Submitted {formatLocal(sub.submitted_at, 'MMM d, h:mm a')}</p>
                </div>
                {sub.status === 'graded' && <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[0.6rem] font-bold uppercase tracking-widest"><span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>check_circle</span>Graded</span>}
              </div>

              {/* Answers */}
              {quiz.content_type === 'file' ? (
                sub.file_path ? <button onClick={() => downloadFile(sub.file_path!)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary text-xs font-bold rounded-xl hover:bg-primary/20"><span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>download</span>Download submission</button> : <p className="text-xs text-on-surface-variant italic">No file.</p>
              ) : (
                <div className="space-y-2.5">
                  {(quiz.questions ?? []).map((q, qi) => {
                    const ans = sub.answers?.find((a) => a.question_id === q.id);
                    return (
                      <div key={q.id} className="text-sm">
                        <p className="font-semibold text-on-surface">Q{qi + 1}. {q.question}</p>
                        {q.type === 'mcq' ? (
                          <p className={`mt-0.5 ${Number(ans?.answer) === q.correct ? 'text-emerald-600' : 'text-error'}`}>
                            <span className="material-symbols-outlined align-middle" style={{ fontSize: '0.9rem' }}>{Number(ans?.answer) === q.correct ? 'check_circle' : 'cancel'}</span>{' '}
                            {ans != null && q.options ? q.options[Number(ans.answer)] ?? '—' : 'No answer'}
                            {Number(ans?.answer) !== q.correct && q.options && <span className="text-on-surface-variant"> · correct: {q.options[q.correct ?? 0]}</span>}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-on-surface-variant whitespace-pre-wrap bg-surface-variant/30 rounded-lg px-3 py-2">{ans?.answer || <span className="italic">No answer</span>}</p>
                        )}
                      </div>
                    );
                  })}
                  {auto != null && <p className="text-xs font-bold text-primary/70">Auto-graded MCQ score: {auto} / {max} pts</p>}
                </div>
              )}

              {/* Grade controls */}
              <div className="border-t border-outline-variant/10 pt-4 grid sm:grid-cols-[auto_1fr_auto] gap-3 items-end">
                <div>
                  <label className="block text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Score / {max}</label>
                  <input type="number" min={0} max={max} className="w-24 px-3 py-2.5 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={draft[sub.id]?.score ?? ''} onChange={(e) => setDraft((p) => ({ ...p, [sub.id]: { ...p[sub.id], score: e.target.value } }))} />
                </div>
                <div>
                  <label className="block text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Feedback</label>
                  <input className="w-full px-3 py-2.5 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="Optional note for the student" value={draft[sub.id]?.feedback ?? ''} onChange={(e) => setDraft((p) => ({ ...p, [sub.id]: { ...p[sub.id], feedback: e.target.value } }))} />
                </div>
                <button onClick={() => saveGrade(sub)} className="px-5 py-2.5 text-sm font-bold academic-gradient text-white rounded-xl shadow-md hover:opacity-90">Save</button>
              </div>
            </div>
          );
        })}
      </div>
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </DashboardLayout>
  );
}
