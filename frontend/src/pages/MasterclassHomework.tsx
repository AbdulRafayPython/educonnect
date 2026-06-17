import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { masterclassNav } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { formatLocal } from '../lib/time';
import {
  homeworkStatusBadge, homeworkStatusOf, isHomeworkOverdue,
  type HomeworkStatus, type MasterclassHomework, type HomeworkSubmission,
} from '../lib/masterclass';

export default function MasterclassHomework() {
  const [items, setItems] = useState<MasterclassHomework[]>([]);
  const [subs, setSubs] = useState<Record<string, HomeworkSubmission>>({});
  const [filter, setFilter] = useState<'all' | HomeworkStatus>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const [{ data: h }, { data: s }] = await Promise.all([
        supabase.from('masterclass_homework').select('*').order('created_at', { ascending: false }),
        supabase.from('masterclass_homework_submissions').select('*').eq('user_id', user?.id ?? ''),
      ]);
      setItems((h as MasterclassHomework[]) ?? []);
      const map: Record<string, HomeworkSubmission> = {};
      (s as HomeworkSubmission[] ?? []).forEach((sub) => { map[sub.homework_id] = sub; });
      setSubs(map);
      setLoading(false);
    })();
  }, []);

  const filtered = filter === 'all' ? items : items.filter((h) => homeworkStatusOf(subs[h.id]) === filter);

  return (
    <DashboardLayout title="Homework" navItems={masterclassNav}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">Homework</h2>
          <p className="text-on-surface-variant text-sm mt-1">{items.length} assignment{items.length === 1 ? '' : 's'}</p>
        </div>

        <div className="flex flex-wrap gap-1 bg-surface-container rounded-xl p-1 w-fit">
          {(['all', 'assigned', 'submitted', 'graded'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3.5 py-2 text-[0.65rem] font-bold uppercase tracking-widest rounded-lg transition-all ${filter === f ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'}`}>{f}</button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-20 rounded-xl bg-surface-container/40 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">assignment</span>
            <p className="text-on-surface-variant font-medium">{filter === 'all' ? 'No homework yet.' : `Nothing ${filter}.`}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((h) => {
              const sub = subs[h.id];
              const st = homeworkStatusOf(sub);
              const overdue = st === 'assigned' && isHomeworkOverdue(h.due_date);
              return (
                <Link key={h.id} to={`/masterclass/homework/${h.id}`} className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/10 hover:border-outline-variant/25 transition-all">
                  <div className="shrink-0 w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: '1.3rem' }}>assignment</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.55rem] font-bold uppercase tracking-widest ${homeworkStatusBadge[st]}`}>{st}</span>
                      {overdue && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.55rem] font-bold uppercase tracking-widest bg-error-container text-on-error-container">Late</span>}
                      {h.week_number != null && <span className="text-[0.55rem] font-bold uppercase tracking-widest text-secondary/50">Week {h.week_number}</span>}
                    </div>
                    <p className="font-bold text-on-surface text-sm truncate">{h.title}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {st === 'graded' && sub?.score != null && h.points != null
                        ? `Scored ${sub.score} / ${h.points}`
                        : st === 'graded'
                          ? 'Reviewed by your teacher'
                          : h.due_date ? `Due ${formatLocal(h.due_date, 'MMM d, h:mm a')}` : 'No due date'}
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
