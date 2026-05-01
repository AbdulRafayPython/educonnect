import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { navForRole } from '../lib/nav';
import { Link } from 'react-router-dom';

interface Course {
  id: string;
  title: string;
  description: string;
  total_lectures: number;
  completed_lectures: number;
  is_archived: boolean;
  created_at: string;
  semester_id: string;
}

interface Semester {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
}

export default function Courses() {
  const { role } = useAppStore();
  const nav = navForRole(role);
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSemesterModal, setShowSemesterModal] = useState(false);
  const [filter, setFilter] = useState<'active' | 'archived'>('active');

  // Form state
  const [newCourse, setNewCourse] = useState({ title: '', description: '', total_lectures: 12, semester_id: '' });
  const [newSemester, setNewSemester] = useState({ title: '', start_date: '', end_date: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [courseRes, semRes] = await Promise.all([
      supabase.from('courses').select('*').order('created_at', { ascending: false }),
      supabase.from('semesters').select('*').order('start_date', { ascending: false }),
    ]);
    if (courseRes.data) setCourses(courseRes.data);
    if (semRes.data) setSemesters(semRes.data);
    setLoading(false);
  };

  const handleCreateCourse = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('courses').insert({
      ...newCourse,
      created_by: user.id,
    });
    if (!error) {
      setShowCreateModal(false);
      setNewCourse({ title: '', description: '', total_lectures: 12, semester_id: '' });
      fetchData();
    }
  };

  const handleCreateSemester = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('semesters').insert({
      ...newSemester,
      created_by: user.id,
    });
    if (!error) {
      setShowSemesterModal(false);
      setNewSemester({ title: '', start_date: '', end_date: '' });
      fetchData();
    }
  };

  const handleArchive = async (id: string) => {
    await supabase.from('courses').update({ is_archived: true }).eq('id', id);
    fetchData();
  };

  const filtered = courses.filter(c => filter === 'active' ? !c.is_archived : c.is_archived);
  const getSemesterTitle = (id: string) => semesters.find(s => s.id === id)?.title || '—';

  return (
    <DashboardLayout title="Courses" navItems={nav}>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-primary tracking-tight">
              {role === 'teacher' ? 'Course Management' : 'My Courses'}
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">{filtered.length} course{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          {role === 'teacher' && (
            <div className="flex gap-3">
              <button onClick={() => setShowSemesterModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-surface-container text-primary text-sm font-bold rounded-xl hover:bg-surface-container-high transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>date_range</span>
                New Semester
              </button>
              <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2.5 academic-gradient text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 transition-all">
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
                Create Course
              </button>
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 bg-surface-container rounded-xl p-1 w-fit">
          {(['active', 'archived'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${filter === f ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >{f}</button>
          ))}
        </div>

        {/* Course Grid */}
        {loading ? (
          <div className="text-center py-20 text-on-surface-variant">Loading courses…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">school</span>
            <p className="text-on-surface-variant font-medium">No {filter} courses yet.</p>
            {role === 'teacher' && <p className="text-sm text-secondary mt-1">Create a course to get started.</p>}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(c => {
              const pct = c.total_lectures > 0 ? Math.round((c.completed_lectures / c.total_lectures) * 100) : 0;
              const detailPath = `${role === 'teacher' ? '/teacher' : '/student'}/courses/${c.id}`;
              return (
                <Link to={detailPath} key={c.id} className="bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/10 flex flex-col hover:shadow-md transition-shadow group">
                  {/* Banner */}
                  <div className="h-24 academic-gradient relative flex items-end p-4">
                    <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMjgiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==')]" />
                    <span className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-lg text-[0.6rem] font-bold text-white uppercase tracking-wider">{getSemesterTitle(c.semester_id)}</span>
                  </div>
                  {/* Body */}
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-on-surface mb-1 truncate">{c.title}</h3>
                    <p className="text-xs text-on-surface-variant line-clamp-2 mb-4">{c.description || 'No description'}</p>
                    {/* Progress */}
                    <div className="mt-auto">
                      <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden mb-2">
                        <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-secondary font-bold">
                        <span>{c.completed_lectures} / {c.total_lectures} lectures</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                    {/* Actions */}
                    {role === 'teacher' && !c.is_archived && (
                      <div className="flex gap-2 mt-4 pt-3 border-t border-outline-variant/10">
                        <button onClick={(e) => { e.preventDefault(); handleArchive(c.id); }} className="text-[0.65rem] font-bold text-secondary hover:text-error uppercase tracking-wider transition-colors">Archive</button>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-surface-container-lowest rounded-2xl p-7 w-full max-w-lg shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-primary">Create New Course</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Title</label>
                <input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="e.g. Advanced Calculus" value={newCourse.title} onChange={e => setNewCourse(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Description</label>
                <textarea className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface resize-none h-20" placeholder="Course description…" value={newCourse.description} onChange={e => setNewCourse(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Total Lectures</label>
                  <input type="number" min={1} className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={newCourse.total_lectures} onChange={e => setNewCourse(p => ({ ...p, total_lectures: +e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Semester</label>
                  <select className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={newCourse.semester_id} onChange={e => setNewCourse(p => ({ ...p, semester_id: e.target.value }))}>
                    <option value="">Select…</option>
                    {semesters.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl hover:bg-surface-container transition-colors">Cancel</button>
              <button onClick={handleCreateCourse} disabled={!newCourse.title} className="px-5 py-2.5 text-sm font-bold academic-gradient text-white rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Semester Modal */}
      {showSemesterModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setShowSemesterModal(false)}>
          <div className="bg-surface-container-lowest rounded-2xl p-7 w-full max-w-md shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-primary">New Semester</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Title</label>
                <input className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" placeholder="e.g. Fall 2026" value={newSemester.title} onChange={e => setNewSemester(p => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Start Date</label>
                  <input type="date" className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={newSemester.start_date} onChange={e => setNewSemester(p => ({ ...p, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">End Date</label>
                  <input type="date" className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface" value={newSemester.end_date} onChange={e => setNewSemester(p => ({ ...p, end_date: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowSemesterModal(false)} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl hover:bg-surface-container transition-colors">Cancel</button>
              <button onClick={handleCreateSemester} disabled={!newSemester.title} className="px-5 py-2.5 text-sm font-bold academic-gradient text-white rounded-xl shadow-md hover:opacity-90 transition-all disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
