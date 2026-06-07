import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../lib/useToast';
import { teacherNav } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { formatLocal } from '../lib/time';
import { cohortMeta, quizTypeMeta, type Cohort, type MasterclassQuiz } from '../lib/masterclass';

export default function TeacherMasterclassQuizzes() {
  const toast = useToast();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<MasterclassQuiz[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [subCounts, setSubCounts] = useState<Map<string, { total: number; pending: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: q }, { data: c }, { data: subs }] = await Promise.all([
      supabase.from('masterclass_quizzes').select('*').order('week_number'),
      supabase.from('cohorts').select('*'),
      supabase.from('masterclass_submissions').select('quiz_id, status'),
    ]);
    const counts = new Map<string, { total: number; pending: number }>();
    (subs ?? []).forEach((s: { quiz_id: string; status: string }) => {
      const cur = counts.get(s.quiz_id) ?? { total: 0, pending: 0 };
      cur.total += 1;
      if (s.status === 'submitted') cur.pending += 1;
      counts.set(s.quiz_id, cur);
    });
    setQuizzes((q as MasterclassQuiz[]) ?? []);
    setCohorts((c as Cohort[]) ?? []);
    setSubCounts(counts);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    const { error } = await supabase.from('masterclass_quizzes').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Quiz deleted');
    load();
  };

  return (
    <DashboardLayout title="Masterclass Quizzes" navItems={teacherNav}>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-primary tracking-tight">Masterclass Quizzes</h2>
            <p className="text-on-surface-variant text-sm mt-1">{quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''}</p>
          </div>
          <Link to="/teacher/masterclass/quizzes/new" className="flex items-center gap-2 px-4 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 transition-all">
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
            New quiz
          </Link>
        </div>

        {loading ? (
          <p className="text-on-surface-variant text-sm">Loading…</p>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">quiz</span>
            <p className="text-on-surface-variant font-medium">No quizzes yet.</p>
            <Link to="/teacher/masterclass/quizzes/new" className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>Create your first quiz
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {quizzes.map((q) => {
              const meta = quizTypeMeta[q.quiz_type];
              const counts = subCounts.get(q.id) ?? { total: 0, pending: 0 };
              return (
                <div key={q.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center">
                      <span className="text-[0.55rem] font-bold uppercase tracking-wider text-primary/60">Wk</span>
                      <span className="text-lg font-extrabold text-primary leading-none">{q.week_number}</span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-widest ${meta.badge}`}>{meta.label}</span>
                        <span className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50">{q.content_type === 'inline' ? `${q.questions?.length ?? 0} questions` : 'File attachment'}</span>
                      </div>
                      <h3 className="font-bold text-on-surface">{q.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                        <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-primary/70" style={{ fontSize: '0.9rem' }}>event</span>Due {formatLocal(q.due_date, 'MMM d, yyyy')}</span>
                        <span className="flex items-center gap-1.5"><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>inbox</span>{counts.total} submitted</span>
                        {counts.pending > 0 && <span className="flex items-center gap-1 text-amber-600 font-bold"><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>pending</span>{counts.pending} to review</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-start gap-2 shrink-0">
                      <Link to={`/teacher/masterclass/quizzes/${q.id}/grade`} className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary text-xs font-bold rounded-xl hover:bg-primary/20 transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>grading</span>Review
                      </Link>
                      <button onClick={() => navigate(`/teacher/masterclass/quizzes/${q.id}/edit`)} title="Edit" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container text-secondary transition-colors"><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>edit</span></button>
                      <button onClick={() => setPendingDeleteId(q.id)} title="Delete" className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-error-container/30 text-error transition-colors"><span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>delete</span></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-3 mt-3 border-t border-outline-variant/10">
                    {(q.cohort_ids ?? []).length === 0
                      ? <span className="text-[0.6rem] font-bold uppercase tracking-widest text-amber-600">No cohorts — hidden from students</span>
                      : q.cohort_ids.map((id) => {
                          const c = cohorts.find((x) => x.id === id);
                          if (!c) return null;
                          return <span key={id} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.6rem] font-semibold ${cohortMeta[c.age_group].badge}`}>{c.name}</span>;
                        })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Delete quiz?"
        message="This permanently removes the quiz and all its submissions."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </DashboardLayout>
  );
}
