import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { supabase } from '../lib/supabase';
import { teacherNav } from '../lib/nav';

interface Student {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
    const channel = supabase
      .channel('students-list-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
      }, () => {
        fetchStudents();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('created_at', { ascending: false });
    if (data) setStudents(data);
    setLoading(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('admin-create-student', {
        body: { email: form.email, password: form.password, full_name: form.full_name },
      });

      if (fnErr) {
        setError(fnErr.message || 'Failed to create student.');
        return;
      }
      if (data?.error) {
        setError(data.error);
        return;
      }

      setSuccess(`Student "${form.full_name}" created. They can log in with the provided credentials.`);
      setForm({ full_name: '', email: '', password: '' });
      fetchStudents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout title="Student Management" navItems={teacherNav}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-primary tracking-tight">Students</h2>
            <p className="text-on-surface-variant text-sm mt-1">{students.length} enrolled student{students.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => { setShowCreate(true); setError(null); setSuccess(null); }} className="flex items-center gap-2 px-4 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 transition-all">
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>person_add</span>
            Create Student
          </button>
        </div>

        {/* Student List */}
        {loading ? (
          <div className="text-center py-20 text-on-surface-variant">Loading…</div>
        ) : students.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">group</span>
            <p className="text-on-surface-variant font-medium">No students enrolled yet.</p>
            <p className="text-sm text-secondary mt-1">Create a student account to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {students.map(s => (
              <div key={s.id} className="bg-surface-container-lowest rounded-2xl px-6 py-4 border border-outline-variant/10 flex items-center gap-4 hover:border-outline-variant/25 transition-all">
                {s.avatar_url ? (
                  <img src={s.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-xl academic-gradient flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {s.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-on-surface text-sm">{s.full_name}</h3>
                  <p className="text-xs text-on-surface-variant truncate">{s.email}</p>
                </div>
                <span className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50 hidden sm:block">
                  Joined {new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Student Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setShowCreate(false)}>
          <div className="bg-surface-container-lowest rounded-2xl p-7 w-full max-w-md shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-primary">Create Student Account</h3>

            {error && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-medium">
                <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>{error}
              </div>
            )}
            {success && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium">
                <span className="material-symbols-outlined text-base mt-0.5 shrink-0">check_circle</span>{success}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Full Name</label>
                <input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="Student's full name" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Email</label>
                <input type="email" className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="student@email.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Password</label>
                <input type="password" className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="Initial password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl">Cancel</button>
              <button onClick={handleCreate} disabled={!form.full_name || !form.email || !form.password || creating}
                className="px-5 py-2.5 text-sm font-bold academic-gradient text-white rounded-xl shadow-md disabled:opacity-50">
                {creating ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
