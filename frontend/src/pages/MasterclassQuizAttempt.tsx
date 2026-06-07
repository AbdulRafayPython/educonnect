import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../lib/useToast';
import { masterclassNav } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { formatLocal } from '../lib/time';
import { maxScoreOf, quizTypeMeta, type MasterclassQuiz, type MasterclassSubmission } from '../lib/masterclass';

export default function MasterclassQuizAttempt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [quiz, setQuiz] = useState<MasterclassQuiz | null>(null);
  const [submission, setSubmission] = useState<MasterclassSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: q } = await supabase.from('masterclass_quizzes').select('*').eq('id', id).single();
    const { data: s } = await supabase.from('masterclass_submissions').select('*').eq('quiz_id', id).eq('user_id', user?.id ?? '').maybeSingle();
    setQuiz((q as MasterclassQuiz) ?? null);
    setSubmission((s as MasterclassSubmission) ?? null);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const downloadQuizFile = async () => {
    if (!quiz?.file_path) return;
    const { data, error } = await supabase.storage.from('masterclass-materials').download(quiz.file_path);
    if (error || !data) { toast.error('Download failed'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = quiz.file_path.split('/').pop() || 'quiz'; a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!quiz) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSubmitting(true);

    if (quiz.content_type === 'inline') {
      const unanswered = (quiz.questions ?? []).filter((qq) => answers[qq.id] === undefined || answers[qq.id] === '');
      if (unanswered.length) { toast.error(`Please answer all ${quiz.questions?.length} questions`); setSubmitting(false); return; }
      const payload = (quiz.questions ?? []).map((qq) => ({ question_id: qq.id, answer: answers[qq.id] }));
      const { error } = await supabase.from('masterclass_submissions').insert({ quiz_id: quiz.id, user_id: user.id, answers: payload });
      if (error) { toast.error(error.message); setSubmitting(false); return; }
    } else {
      if (!file) { toast.error('Please attach your file'); setSubmitting(false); return; }
      const path = `${user.id}/${quiz.id}-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('masterclass-submissions').upload(path, file);
      if (upErr) { toast.error('Upload failed', upErr.message); setSubmitting(false); return; }
      const { error } = await supabase.from('masterclass_submissions').insert({ quiz_id: quiz.id, user_id: user.id, file_path: path });
      if (error) { toast.error(error.message); setSubmitting(false); return; }
    }
    toast.success('Submitted! Your teacher will review it.');
    load();
    setSubmitting(false);
  };

  if (loading) return <DashboardLayout title="Quiz" navItems={masterclassNav}><div className="max-w-2xl mx-auto h-80 rounded-2xl bg-surface-container/40 animate-pulse" /></DashboardLayout>;
  if (!quiz) return <DashboardLayout title="Quiz" navItems={masterclassNav}><div className="max-w-2xl mx-auto text-center py-20"><p className="text-on-surface-variant">Quiz not found.</p><button onClick={() => navigate('/masterclass/quizzes')} className="mt-4 text-sm font-bold text-primary hover:underline">← Back</button></div></DashboardLayout>;

  const max = maxScoreOf(quiz);
  const done = !!submission;

  return (
    <DashboardLayout title={`Week ${quiz.week_number} quiz`} navItems={masterclassNav}>
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/masterclass/quizzes')} className="inline-flex items-center gap-1 text-sm font-bold text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_back</span>Quizzes
        </button>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-widest ${quizTypeMeta[quiz.quiz_type].badge}`}>{quizTypeMeta[quiz.quiz_type].label}</span>
            <span className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50">Due {formatLocal(quiz.due_date, 'MMM d, h:mm a')} · {max} pts</span>
          </div>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">{quiz.title}</h2>
          {quiz.description && <p className="text-sm text-on-surface-variant mt-1.5">{quiz.description}</p>}
        </div>

        {/* Graded result banner */}
        {submission?.status === 'graded' && (
          <div className="rounded-2xl academic-gradient text-white p-6">
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-white/70">Your result</p>
            <p className="text-3xl font-extrabold mt-1">{submission.score} <span className="text-lg text-white/70">/ {max}</span></p>
            {submission.feedback && <div className="mt-3 bg-white/10 rounded-xl p-3 text-sm"><p className="text-[0.6rem] font-bold uppercase tracking-widest text-white/60 mb-1">Feedback</p>{submission.feedback}</div>}
          </div>
        )}
        {submission && submission.status === 'submitted' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/10 text-primary text-sm font-medium">
            <span className="material-symbols-outlined text-base">hourglass_top</span>
            Submitted on {formatLocal(submission.submitted_at, 'MMM d, h:mm a')} — awaiting your teacher's review.
          </div>
        )}

        {/* Inline questions */}
        {quiz.content_type === 'inline' && (
          <div className="space-y-3">
            {(quiz.questions ?? []).map((q, qi) => {
              const myAnswer = submission?.answers?.find((a) => a.question_id === q.id)?.answer;
              return (
                <div key={q.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
                  <p className="font-bold text-on-surface text-sm mb-3">Q{qi + 1}. {q.question} <span className="text-on-surface-variant font-normal">({q.points} pt{q.points !== 1 ? 's' : ''})</span></p>
                  {q.type === 'mcq' ? (
                    <div className="space-y-2">
                      {(q.options ?? []).map((opt, oi) => {
                        const selected = done ? Number(myAnswer) === oi : answers[q.id] === oi;
                        const correct = done && submission?.status === 'graded' && q.correct === oi;
                        return (
                          <label key={oi} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${selected ? 'border-primary bg-primary/5' : 'border-outline-variant/40'} ${correct ? 'border-emerald-400 bg-emerald-50' : ''} ${done ? 'cursor-default' : ''}`}>
                            <input type="radio" name={q.id} disabled={done} checked={selected} onChange={() => setAnswers((p) => ({ ...p, [q.id]: oi }))} className="accent-primary" />
                            <span className="text-sm text-on-surface">{opt}</span>
                            {correct && <span className="material-symbols-outlined text-emerald-500 ml-auto" style={{ fontSize: '1rem' }}>check_circle</span>}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    done ? (
                      <p className="text-sm text-on-surface-variant whitespace-pre-wrap bg-surface-variant/30 rounded-lg px-3 py-2">{String(myAnswer ?? '') || <span className="italic">No answer</span>}</p>
                    ) : (
                      <textarea className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface resize-none h-20" placeholder="Your answer…" value={String(answers[q.id] ?? '')} onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))} />
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* File-based */}
        {quiz.content_type === 'file' && (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-6 space-y-4">
            {quiz.file_path && (
              <button onClick={downloadQuizFile} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary text-sm font-bold rounded-xl hover:bg-primary/20">
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>download</span>Download quiz file
              </button>
            )}
            {done ? (
              <p className="text-sm text-on-surface-variant flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500" style={{ fontSize: '1.1rem' }}>check_circle</span>Your file has been submitted.</p>
            ) : (
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Upload your answer</label>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary" />
              </div>
            )}
          </div>
        )}

        {!done && (
          <div className="flex justify-end">
            <button onClick={submit} disabled={submitting} className="px-6 py-3 text-sm font-bold academic-gradient text-white rounded-xl shadow-lg hover:opacity-90 disabled:opacity-60 flex items-center gap-2">
              {submitting ? <><span className="material-symbols-outlined animate-spin text-base">progress_activity</span>Submitting…</> : <>Submit quiz<span className="material-symbols-outlined text-base">send</span></>}
            </button>
          </div>
        )}
      </div>
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </DashboardLayout>
  );
}
