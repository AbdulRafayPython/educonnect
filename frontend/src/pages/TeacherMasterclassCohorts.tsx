import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../lib/useToast';
import { teacherNav } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { cohortMeta, type AgeGroup, type Cohort } from '../lib/masterclass';
import { formatLocal } from '../lib/time';

interface Student {
  id: string;
  full_name: string | null;
  email: string | null;
  age_group: AgeGroup | null;
  avatar_url: string | null;
  cohort_id: string | null;
  created_at: string;
  sessions_attended: number;
  quizzes_completed: number;
}

export default function TeacherMasterclassCohorts() {
  const toast = useToast();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<{ name: string; age_group: AgeGroup }>({ name: '', age_group: 'little_ones' });

  const load = async () => {
    setLoading(true);
    const [{ data: cohortRows }, { data: profileRows }, { data: attendance }, { data: submissions }] = await Promise.all([
      supabase.from('cohorts').select('*').order('created_at'),
      supabase.from('profiles').select('id, full_name, email, age_group, avatar_url, cohort_id, created_at').eq('role', 'student_group'),
      supabase.from('masterclass_attendance').select('user_id'),
      supabase.from('masterclass_submissions').select('user_id'),
    ]);
    const attCount = new Map<string, number>();
    (attendance ?? []).forEach((a: { user_id: string }) => attCount.set(a.user_id, (attCount.get(a.user_id) ?? 0) + 1));
    const subCount = new Map<string, number>();
    (submissions ?? []).forEach((s: { user_id: string }) => subCount.set(s.user_id, (subCount.get(s.user_id) ?? 0) + 1));

    setCohorts((cohortRows as Cohort[]) ?? []);
    setStudents(((profileRows as any[]) ?? []).map((p) => ({
      ...p,
      sessions_attended: attCount.get(p.id) ?? 0,
      quizzes_completed: subCount.get(p.id) ?? 0,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createCohort = async () => {
    if (!form.name.trim()) { toast.error('Cohort name is required'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('cohorts').insert({
      name: form.name.trim(), age_group: form.age_group, is_active: true, created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Cohort created');
    setShowCreate(false);
    setForm({ name: '', age_group: 'little_ones' });
    load();
  };

  const exportCsv = () => {
    const header = ['Name', 'Email', 'Age group', 'Cohort', 'Joined', 'Sessions attended', 'Quizzes completed'];
    const rows = students.map((s) => [
      s.full_name ?? '',
      s.email ?? '',
      s.age_group ? cohortMeta[s.age_group].short : '',
      cohorts.find((c) => c.id === s.cohort_id)?.name ?? '',
      formatLocal(s.created_at, 'yyyy-MM-dd'),
      String(s.sessions_attended),
      String(s.quizzes_completed),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `masterclass-roster-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const studentsIn = (cohortId: string) => students.filter((s) => s.cohort_id === cohortId);
  const unassigned = students.filter((s) => !s.cohort_id);

  return (
    <DashboardLayout title="Cohorts" navItems={teacherNav}>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-primary tracking-tight">Cohort Roster</h2>
            <p className="text-on-surface-variant text-sm mt-1">{students.length} student{students.length !== 1 ? 's' : ''} across {cohorts.length} cohort{cohorts.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCsv} disabled={students.length === 0} className="flex items-center gap-2 px-4 py-2.5 bg-surface-container text-on-surface text-sm font-bold rounded-xl hover:bg-surface-container-high transition-all disabled:opacity-50">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>download</span>
              Export CSV
            </button>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
              New Cohort
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-on-surface-variant text-sm">Loading…</p>
        ) : cohorts.length === 0 && students.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-lowest rounded-2xl border border-outline-variant/10">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">groups</span>
            <p className="text-on-surface-variant font-medium">No cohorts yet.</p>
            <p className="text-sm text-on-surface-variant mt-1">Create a cohort, or students auto-create one when they onboard.</p>
            <button onClick={() => setShowCreate(true)} className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
              Create your first cohort
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {cohorts.map((c) => {
              const meta = cohortMeta[c.age_group];
              const list = studentsIn(c.id);
              return (
                <div key={c.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between border-b border-outline-variant/10">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.badge}`}>{meta.short}</span>
                      <h3 className="font-bold text-on-surface">{c.name}</h3>
                      {!c.is_active && <span className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50">Inactive</span>}
                    </div>
                    <span className="text-xs font-bold text-on-surface-variant">{list.length} student{list.length !== 1 ? 's' : ''}</span>
                  </div>
                  {list.length === 0 ? (
                    <p className="px-5 py-6 text-sm text-on-surface-variant text-center">No students enrolled yet.</p>
                  ) : (
                    <RosterTable rows={list} />
                  )}
                </div>
              );
            })}

            {unassigned.length > 0 && (
              <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
                <div className="px-5 py-4 border-b border-outline-variant/10">
                  <h3 className="font-bold text-on-surface">Not yet enrolled</h3>
                </div>
                <RosterTable rows={unassigned} />
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Cohort">
        <div className="space-y-4">
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Name</label>
            <input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="e.g. Little Explorers — Batch 1" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Age group</label>
            <select className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={form.age_group} onChange={(e) => setForm((p) => ({ ...p, age_group: e.target.value as AgeGroup }))}>
              {(Object.keys(cohortMeta) as AgeGroup[]).map((g) => <option key={g} value={g}>{cohortMeta[g].label} — {cohortMeta[g].short}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl hover:bg-surface-container">Cancel</button>
          <button onClick={createCohort} className="px-5 py-2.5 text-sm font-bold academic-gradient text-white rounded-xl shadow-md hover:opacity-90">Create</button>
        </div>
      </Modal>

      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </DashboardLayout>
  );
}

function RosterTable({ rows }: { rows: Student[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant bg-surface-container/40">
            <th className="px-5 py-2.5 font-bold">Student</th>
            <th className="px-3 py-2.5 font-bold">Joined</th>
            <th className="px-3 py-2.5 font-bold text-center">Sessions</th>
            <th className="px-3 py-2.5 font-bold text-center">Quizzes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const initials = (s.full_name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
            return (
              <tr key={s.id} className="border-t border-outline-variant/10">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg academic-gradient flex items-center justify-center text-white text-[0.65rem] font-bold shrink-0">{initials}</div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-on-surface truncate">{s.full_name || 'Unnamed'}</p>
                      <p className="text-xs text-on-surface-variant truncate">{s.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-on-surface-variant whitespace-nowrap">{formatLocal(s.created_at, 'MMM d, yyyy')}</td>
                <td className="px-3 py-3 text-center font-bold text-on-surface">{s.sessions_attended}</td>
                <td className="px-3 py-3 text-center font-bold text-on-surface">{s.quizzes_completed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
