import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { masterclassNav } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { formatLocal } from '../lib/time';
import { maxScoreOf, quizTypeMeta, type MasterclassQuiz, type MasterclassSubmission } from '../lib/masterclass';

type Status = 'pending' | 'submitted' | 'graded';
const statusBadge: Record<Status, string> = {
  pending: 'bg-amber-100 text-amber-700',
  submitted: 'bg-primary/10 text-primary',
  graded: 'bg-emerald-50 text-emerald-600',
};

export default function MasterclassQuizzes() {
  const [quizzes, setQuizzes] = useState<MasterclassQuiz[]>([]);
  const [subs, setSubs] = useState<Record<string, MasterclassSubmission>>({});
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const [{ data: q }, { data: s }] = await Promise.all([
        supabase.from('masterclass_quizzes').select('*').order('week_number'),
        supabase.from('masterclass_submissions').select('*').eq('user_id', user?.id ?? ''),
      ]);
      setQuizzes((q as MasterclassQuiz[]) ?? []);
      const map: Record<string, MasterclassSubmission> = {};
      (s as MasterclassSubmission[] ?? []).forEach((sub) => { map[sub.quiz_id] = sub; });
      setSubs(map);
      setLoading(false);
    })();
  }, []);

  const statusOf = (q: MasterclassQuiz): Status => {
    const sub = subs[q.id];
    return sub ? (sub.status === 'graded' ? 'graded' : 'submitted') : 'pending';
  };

  const filtered = filter === 'all' ? quizzes : quizzes.filter((q) => statusOf(q) === filter);

  return (
    <DashboardLayout title="Quizzes" navItems={masterclassNav}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">Quizzes & challenges</h2>
          <p className="text-on-surface-variant text-sm mt-1">{quizzes.length} total</p>
        </div>

        <div className="flex flex-wrap gap-1 bg-surface-container rounded-xl p-1 w-fit">
          {(['all', 'pending', 'submitted', 'graded'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3.5 py-2 text-[0.65rem] font-bold uppercase tracking-widest rounded-lg transition-all ${filter === f ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}>{f}</button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-20 rounded-xl bg-surface-container/40 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">quiz</span>
            <p className="text-on-surface-variant font-medium">{filter === 'all' ? 'No quizzes yet.' : `Nothing ${filter}.`}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((q) => {
              const st = statusOf(q);
              const sub = subs[q.id];
              return (
                <Link key={q.id} to={`/masterclass/quizzes/${q.id}`} className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/10 hover:border-outline-variant/25 transition-all">
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-primary/10 flex flex-col items-center justify-center">
                    <span className="text-[0.5rem] font-bold uppercase text-primary/60 leading-none">Wk</span>
                    <span className="text-base font-extrabold text-primary leading-none">{q.week_number}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.55rem] font-bold uppercase tracking-widest ${statusBadge[st]}`}>{st}</span>
                      <span className="text-[0.55rem] font-bold uppercase tracking-widest text-secondary/50">{quizTypeMeta[q.quiz_type].label}</span>
                    </div>
                    <p className="font-bold text-on-surface text-sm truncate">{q.title}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {st === 'graded' && sub?.score != null ? `Scored ${sub.score} / ${maxScoreOf(q)}` : `Due ${formatLocal(q.due_date, 'MMM d, h:mm a')}`}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-outline" style={{ fontSize: '1.2rem' }}>chevron_right</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
