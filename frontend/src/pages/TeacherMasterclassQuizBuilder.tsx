import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../lib/useToast';
import { teacherNav } from '../lib/nav';
import { supabase } from '../lib/supabase';
import {
  cohortMeta, quizTypeMeta, type Cohort, type MasterclassQuiz, type MasterclassSession,
  type QuizQuestion, type QuizType,
} from '../lib/masterclass';

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const blankQuestion = (): QuizQuestion => ({ id: newId(), type: 'mcq', question: '', options: ['', ''], correct: 0, points: 1 });

export default function TeacherMasterclassQuizBuilder() {
  const { id } = useParams();
  const editing = id && id !== 'new';
  const navigate = useNavigate();
  const toast = useToast();

  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [sessions, setSessions] = useState<MasterclassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [weekNumber, setWeekNumber] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quizType, setQuizType] = useState<QuizType>('knowledge_check');
  const [cohortIds, setCohortIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [contentType, setContentType] = useState<'inline' | 'file'>('inline');
  const [questions, setQuestions] = useState<QuizQuestion[]>([blankQuestion()]);
  const [maxScore, setMaxScore] = useState(10);
  const [file, setFile] = useState<File | null>(null);
  const [existingFilePath, setExistingFilePath] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: s }] = await Promise.all([
        supabase.from('cohorts').select('*').order('created_at'),
        supabase.from('masterclass_sessions').select('*').order('week_number'),
      ]);
      setCohorts((c as Cohort[]) ?? []);
      setSessions((s as MasterclassSession[]) ?? []);
      if (editing) {
        const { data: q } = await supabase.from('masterclass_quizzes').select('*').eq('id', id).single();
        if (q) {
          const quiz = q as MasterclassQuiz;
          setWeekNumber(quiz.week_number);
          setTitle(quiz.title);
          setDescription(quiz.description ?? '');
          setQuizType(quiz.quiz_type);
          setCohortIds(quiz.cohort_ids ?? []);
          setDueDate(quiz.due_date ? new Date(quiz.due_date).toISOString().slice(0, 16) : '');
          setContentType(quiz.content_type);
          setQuestions(quiz.questions && quiz.questions.length ? quiz.questions : [blankQuestion()]);
          setMaxScore(quiz.max_score);
          setExistingFilePath(quiz.file_path);
        }
      } else {
        setCohortIds(((c as Cohort[]) ?? []).map((x) => x.id));
      }
      setLoading(false);
    })();
  }, [id]);

  // FR-QUIZ-MC-01: default due date to 6 days after that week's session.
  const suggestDue = (week: number) => {
    const sess = sessions.find((s) => s.week_number === week);
    if (sess) {
      const d = new Date(sess.scheduled_at);
      d.setDate(d.getDate() + 6);
      setDueDate(d.toISOString().slice(0, 16));
    }
  };

  const toggleCohort = (cid: string) => setCohortIds((p) => p.includes(cid) ? p.filter((x) => x !== cid) : [...p, cid]);

  const updateQ = (qid: string, patch: Partial<QuizQuestion>) =>
    setQuestions((p) => p.map((q) => q.id === qid ? { ...q, ...patch } : q));
  const moveQ = (idx: number, dir: -1 | 1) => setQuestions((p) => {
    const next = [...p];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return p;
    [next[idx], next[j]] = [next[j], next[idx]];
    return next;
  });

  const save = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (!dueDate) { toast.error('Due date is required'); return; }
    if (contentType === 'inline') {
      if (questions.length === 0 || questions.some((q) => !q.question.trim())) { toast.error('Every question needs text'); return; }
      if (questions.some((q) => q.type === 'mcq' && (q.options ?? []).filter((o) => o.trim()).length < 2)) { toast.error('MCQs need at least 2 options'); return; }
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    let filePath = existingFilePath;
    if (contentType === 'file' && file) {
      const path = `quizzes/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('masterclass-materials').upload(path, file);
      if (upErr) { toast.error('File upload failed', upErr.message); setSaving(false); return; }
      filePath = path;
    }
    if (contentType === 'file' && !filePath) { toast.error('Please attach a file'); setSaving(false); return; }

    const cleanedQuestions = contentType === 'inline'
      ? questions.map((q) => q.type === 'mcq'
          ? { ...q, options: (q.options ?? []).filter((o) => o.trim()) }
          : { id: q.id, type: 'short' as const, question: q.question, points: q.points })
      : null;

    const payload = {
      week_number: weekNumber,
      title: title.trim(),
      description: description || null,
      quiz_type: quizType,
      cohort_ids: cohortIds,
      due_date: new Date(dueDate).toISOString(),
      content_type: contentType,
      questions: cleanedQuestions,
      file_path: contentType === 'file' ? filePath : null,
      max_score: contentType === 'inline' && cleanedQuestions
        ? cleanedQuestions.reduce((s, q) => s + (q.points || 0), 0)
        : maxScore,
    };

    const { error } = editing
      ? await supabase.from('masterclass_quizzes').update(payload).eq('id', id)
      : await supabase.from('masterclass_quizzes').insert({ ...payload, created_by: user?.id });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success(editing ? 'Quiz updated' : 'Quiz created');
    navigate('/teacher/masterclass/quizzes');
  };

  if (loading) {
    return <DashboardLayout title="Quiz" navItems={teacherNav}><div className="max-w-2xl mx-auto h-96 rounded-2xl bg-surface-container/40 animate-pulse" /></DashboardLayout>;
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface';

  return (
    <DashboardLayout title={editing ? 'Edit quiz' : 'New quiz'} navItems={teacherNav}>
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/teacher/masterclass/quizzes')} className="inline-flex items-center gap-1 text-sm font-bold text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_back</span>Quizzes
        </button>

        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Week</label>
              <input type="number" min={1} max={12} className={inputCls} value={weekNumber} onChange={(e) => { setWeekNumber(+e.target.value); }} onBlur={(e) => { if (!dueDate) suggestDue(+e.target.value); }} />
            </div>
            <div className="col-span-2">
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Type</label>
              <select className={inputCls} value={quizType} onChange={(e) => setQuizType(e.target.value as QuizType)}>
                {(Object.keys(quizTypeMeta) as QuizType[]).map((t) => <option key={t} value={t}>{quizTypeMeta[t].label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Title</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Description</label>
            <textarea className={`${inputCls} resize-none h-16`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Due date {sessions.some((s) => s.week_number === weekNumber) && <button type="button" onClick={() => suggestDue(weekNumber)} className="ml-2 text-primary normal-case tracking-normal">use +6 days from session</button>}</label>
            <input type="datetime-local" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Target cohorts</label>
            <div className="flex flex-wrap gap-2">
              {cohorts.length === 0 ? <p className="text-xs text-amber-600">Create a cohort first.</p> : cohorts.map((c) => {
                const on = cohortIds.includes(c.id);
                return <button key={c.id} type="button" onClick={() => toggleCohort(c.id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${on ? cohortMeta[c.age_group].badge + ' border-transparent' : 'border-outline-variant/50 text-on-surface-variant'}`}>{on && '✓ '}{c.name}</button>;
              })}
            </div>
          </div>
        </div>

        {/* Content type toggle */}
        <div className="flex gap-1 bg-surface-container rounded-xl p-1 w-fit">
          {(['inline', 'file'] as const).map((t) => (
            <button key={t} onClick={() => setContentType(t)} className={`px-4 py-2 text-[0.65rem] font-bold uppercase tracking-widest rounded-lg transition-all ${contentType === t ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}>
              {t === 'inline' ? 'Inline questions' : 'File attachment'}
            </button>
          ))}
        </div>

        {contentType === 'inline' ? (
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <div key={q.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-on-surface-variant">Q{idx + 1}</span>
                  <select className="px-3 py-1.5 rounded-lg bg-surface-variant/40 border-none outline-none text-xs text-on-surface" value={q.type} onChange={(e) => updateQ(q.id, e.target.value === 'mcq' ? { type: 'mcq', options: q.options ?? ['', ''], correct: q.correct ?? 0 } : { type: 'short' })}>
                    <option value="mcq">Multiple choice</option>
                    <option value="short">Short answer</option>
                  </select>
                  <div className="ml-auto flex items-center gap-1">
                    <input type="number" min={1} title="Points" className="w-16 px-2 py-1.5 rounded-lg bg-surface-variant/40 border-none outline-none text-xs text-on-surface text-center" value={q.points} onChange={(e) => updateQ(q.id, { points: +e.target.value })} />
                    <span className="text-[0.6rem] text-on-surface-variant mr-1">pts</span>
                    <button aria-label={`Move question ${idx + 1} up`} onClick={() => moveQ(idx, -1)} className="w-7 h-7 rounded-lg hover:bg-surface-container text-secondary flex items-center justify-center"><span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_upward</span></button>
                    <button aria-label={`Move question ${idx + 1} down`} onClick={() => moveQ(idx, 1)} className="w-7 h-7 rounded-lg hover:bg-surface-container text-secondary flex items-center justify-center"><span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_downward</span></button>
                    <button aria-label={`Delete question ${idx + 1}`} onClick={() => setQuestions((p) => p.filter((x) => x.id !== q.id))} className="w-7 h-7 rounded-lg hover:bg-error-container/30 text-error flex items-center justify-center"><span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>delete</span></button>
                  </div>
                </div>
                <input className={inputCls} placeholder="Question text" value={q.question} onChange={(e) => updateQ(q.id, { question: e.target.value })} />
                {q.type === 'mcq' && (
                  <div className="space-y-2">
                    {(q.options ?? []).map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <button onClick={() => updateQ(q.id, { correct: oi })} title="Mark correct" aria-label={`Mark option ${oi + 1} correct`} aria-pressed={q.correct === oi} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${q.correct === oi ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-outline-variant'}`}>
                          {q.correct === oi && <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>check</span>}
                        </button>
                        <input className="flex-1 px-3 py-2 rounded-lg bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder={`Option ${oi + 1}`} value={opt} onChange={(e) => updateQ(q.id, { options: (q.options ?? []).map((o, i) => i === oi ? e.target.value : o) })} />
                        {(q.options ?? []).length > 2 && <button aria-label={`Remove option ${oi + 1}`} onClick={() => updateQ(q.id, { options: (q.options ?? []).filter((_, i) => i !== oi), correct: Math.min(q.correct ?? 0, (q.options ?? []).length - 2) })} className="w-7 h-7 rounded-lg hover:bg-surface-container text-secondary flex items-center justify-center"><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>close</span></button>}
                      </div>
                    ))}
                    <button onClick={() => updateQ(q.id, { options: [...(q.options ?? []), ''] })} className="text-xs font-bold text-primary hover:underline">+ Add option</button>
                    <p className="text-[0.6rem] text-on-surface-variant">Tap the circle to mark the correct answer (auto-graded).</p>
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setQuestions((p) => [...p, blankQuestion()])} className="w-full py-3 rounded-2xl border-2 border-dashed border-outline-variant/40 text-sm font-bold text-on-surface-variant hover:border-primary hover:text-primary transition-all">
              + Add question
            </button>
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-6 space-y-4">
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Quiz file</label>
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary" />
              {existingFilePath && !file && <p className="text-xs text-on-surface-variant mt-2">Current: {existingFilePath.split('/').pop()}</p>}
            </div>
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Max score</label>
              <input type="number" min={1} className={`${inputCls} max-w-[120px]`} value={maxScore} onChange={(e) => setMaxScore(+e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={() => navigate('/teacher/masterclass/quizzes')} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl hover:bg-surface-container">Cancel</button>
          <button onClick={save} disabled={saving} className="px-6 py-2.5 text-sm font-bold academic-gradient text-white rounded-xl shadow-md hover:opacity-90 disabled:opacity-60">{saving ? 'Saving…' : editing ? 'Save quiz' : 'Create quiz'}</button>
        </div>
      </div>

      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </DashboardLayout>
  );
}
