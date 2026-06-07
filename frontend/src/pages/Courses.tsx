import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { navForRole } from '../lib/nav';
import { coverArtFor } from '../lib/coverArt';
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
  thumbnail_url: string | null;
}

interface Semester {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function Courses() {
  const { role } = useAppStore();
  const nav = navForRole(role);
  const isTeacher = role === 'teacher';
  const [courses, setCourses] = useState<Course[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSemesterModal, setShowSemesterModal] = useState(false);
  // 'all' | 'archived' | <semester id>
  const [tab, setTab] = useState<string>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [creating, setCreating] = useState(false);

  // Form state
  const [newCourse, setNewCourse] = useState({ title: '', description: '', total_lectures: 12, semester_id: '' });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [newSemester, setNewSemester] = useState({ title: '', start_date: '', end_date: '' });

  // Per-card thumbnail upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [courseRes, semRes] = await Promise.all([
      supabase.from('courses').select('*').order('created_at', { ascending: false }),
      supabase.from('semesters').select('*').order('start_date', { ascending: false }),
    ]);
    if (courseRes.data) setCourses(courseRes.data as Course[]);
    if (semRes.data) setSemesters(semRes.data);
    setLoading(false);
  };

  // Upload a cover to the public branding bucket and return its cache-busted URL.
  const uploadCover = async (courseId: string, file: File): Promise<string | null> => {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `course-covers/${courseId}.${ext}`;
    const { error } = await supabase.storage
      .from('branding')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) return null;
    const { data } = supabase.storage.from('branding').getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
  };

  const handleCreateCourse = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase
      .from('courses')
      .insert({ ...newCourse, created_by: user.id })
      .select()
      .single();
    if (!error && data) {
      if (coverFile) {
        const url = await uploadCover(data.id, coverFile);
        if (url) await supabase.from('courses').update({ thumbnail_url: url }).eq('id', data.id);
      }
      setShowCreateModal(false);
      setNewCourse({ title: '', description: '', total_lectures: 12, semester_id: '' });
      setCoverFile(null);
      fetchData();
    }
    setCreating(false);
  };

  const handleCreateSemester = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('semesters').insert({ ...newSemester, created_by: user.id });
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

  // Triggered by the per-card camera button
  const onPickCover = (e: React.MouseEvent, courseId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadTargetId(courseId);
    fileInputRef.current?.click();
  };

  const onCoverSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadTargetId) return;
    const id = uploadTargetId;
    setUploadingId(id);
    const url = await uploadCover(id, file);
    if (url) {
      await supabase.from('courses').update({ thumbnail_url: url }).eq('id', id);
      setCourses(prev => prev.map(c => (c.id === id ? { ...c, thumbnail_url: url } : c)));
    }
    setUploadingId(null);
    setUploadTargetId(null);
  };

  const semTitle = (id: string) => semesters.find(s => s.id === id)?.title || 'General';

  const filtered = courses.filter(c => {
    if (tab === 'archived') return c.is_archived;
    if (c.is_archived) return false;
    if (tab === 'all') return true;
    return c.semester_id === tab;
  });

  const tabs = [
    { id: 'all', label: 'All Courses' },
    ...semesters.map(s => ({ id: s.id, label: s.title })),
    { id: 'archived', label: 'Archived' },
  ];

  const StatusPill = ({ archived }: { archived: boolean }) => (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.7rem] font-bold ${
        archived
          ? 'bg-surface-container-high text-on-surface-variant'
          : 'bg-success-container text-on-success-container'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${archived ? 'bg-on-surface-variant' : 'bg-success'}`} />
      {archived ? 'Archived' : 'Active'}
    </span>
  );

  // Reusable thumbnail (uploaded image or deterministic placeholder)
  const Thumb = ({ c, tall }: { c: Course; tall?: boolean }) => {
    const art = coverArtFor(c.id || c.title);
    const h = tall ? 'h-40' : 'h-full';
    return (
      <div className={`${h} relative overflow-hidden ${tall ? 'rounded-t-2xl' : 'rounded-xl'}`}>
        {c.thumbnail_url ? (
          <img src={c.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: art.gradient }}>
            <span className="material-symbols-outlined" style={{ fontSize: tall ? '2.75rem' : '1.6rem', color: art.tint, opacity: 0.85 }}>
              {art.icon}
            </span>
          </div>
        )}
        {/* category (semester) pill */}
        {tall && (
          <span className="absolute top-3 left-3 bg-surface/90 backdrop-blur px-2.5 py-1 rounded-full text-[0.65rem] font-bold text-on-surface shadow-sm">
            {semTitle(c.semester_id)}
          </span>
        )}
        {/* teacher cover upload */}
        {isTeacher && tall && (
          <button
            onClick={(e) => onPickCover(e, c.id)}
            title="Change cover image"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-surface/90 backdrop-blur flex items-center justify-center text-on-surface shadow-sm hover:bg-surface transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>
              {uploadingId === c.id ? 'hourglass_top' : 'photo_camera'}
            </span>
          </button>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout title="Courses" navItems={nav}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-on-surface tracking-tight">
              {isTeacher ? 'Courses' : 'My Courses'}
            </h2>
            <p className="text-on-surface-variant text-sm mt-1">
              {isTeacher ? 'Create and manage courses in your school.' : `${filtered.length} course${filtered.length !== 1 ? 's' : ''} enrolled.`}
            </p>
          </div>
          {isTeacher && (
            <div className="flex gap-2.5">
              <button
                onClick={() => setShowSemesterModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-surface text-on-surface text-sm font-bold rounded-xl border border-outline-variant hover:bg-surface-container transition-colors press-shrink"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>date_range</span>
                New Semester
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl shadow-sm hover:opacity-90 transition-all press-shrink"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
                New Course
              </button>
            </div>
          )}
        </div>

        {/* Tabs + view toggle */}
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant">
          <div className="flex gap-1 overflow-x-auto -mb-px">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-primary text-on-surface'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="hidden sm:flex items-center gap-1 bg-surface-container rounded-lg p-1 shrink-0">
            {(['grid', 'list'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                title={`${v} view`}
                className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                  view === v ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>
                  {v === 'grid' ? 'grid_view' : 'view_list'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="h-40 skeleton" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-3/4 skeleton rounded" />
                  <div className="h-3 w-full skeleton rounded" />
                  <div className="h-8 w-full skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-20">
            <span className="material-symbols-outlined text-5xl text-outline/40 mb-3 block">school</span>
            <p className="text-on-surface font-bold">No {tab === 'archived' ? 'archived' : ''} courses yet.</p>
            {isTeacher && tab !== 'archived' && <p className="text-sm text-on-surface-variant mt-1">Create a course to get started.</p>}
          </div>
        ) : view === 'grid' ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(c => {
              const detailPath = `${isTeacher ? '/teacher' : '/student'}/courses/${c.id}`;
              return (
                <Link
                  to={detailPath}
                  key={c.id}
                  className="card overflow-hidden flex flex-col hover-lift"
                >
                  <Thumb c={c} tall />
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-on-surface leading-snug line-clamp-2 mb-1">{c.title}</h3>
                    <p className="text-xs text-on-surface-variant line-clamp-1 mb-4">{c.description || 'No description'}</p>

                    {/* Meta row */}
                    <div className="mt-auto grid grid-cols-3 gap-2 pt-4 border-t border-outline-variant">
                      <div>
                        <p className="text-[0.6rem] uppercase tracking-wider text-on-surface-variant/70 font-bold mb-1">Created</p>
                        <p className="text-xs font-bold text-on-surface">{fmtDate(c.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-[0.6rem] uppercase tracking-wider text-on-surface-variant/70 font-bold mb-1">Lectures</p>
                        <p className="text-xs font-bold text-on-surface">{c.completed_lectures}/{c.total_lectures}</p>
                      </div>
                      <div>
                        <p className="text-[0.6rem] uppercase tracking-wider text-on-surface-variant/70 font-bold mb-1">Status</p>
                        <StatusPill archived={c.is_archived} />
                      </div>
                    </div>

                    {isTeacher && !c.is_archived && (
                      <button
                        onClick={(e) => { e.preventDefault(); handleArchive(c.id); }}
                        className="self-start mt-3 text-[0.65rem] font-bold text-on-surface-variant hover:text-error uppercase tracking-wider transition-colors"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="card divide-y divide-outline-variant overflow-hidden">
            {filtered.map(c => {
              const detailPath = `${isTeacher ? '/teacher' : '/student'}/courses/${c.id}`;
              return (
                <Link
                  to={detailPath}
                  key={c.id}
                  className="flex items-center gap-4 p-3.5 hover:bg-surface-container/50 transition-colors"
                >
                  <div className="w-14 h-14 shrink-0">
                    <Thumb c={c} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-on-surface truncate">{c.title}</h3>
                    <p className="text-xs text-on-surface-variant truncate">{semTitle(c.semester_id)} · {c.completed_lectures}/{c.total_lectures} lectures</p>
                  </div>
                  <div className="hidden sm:block text-xs font-semibold text-on-surface-variant w-24 text-right">{fmtDate(c.created_at)}</div>
                  <div className="shrink-0"><StatusPill archived={c.is_archived} /></div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Hidden input for per-card cover uploads */}
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onCoverSelected} />

      {/* Create Course Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} maxWidth="lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-on-surface">New Course</h3>
          <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '1.3rem' }}>close</span>
          </button>
        </div>
        <div className="space-y-4">
          {/* Cover picker */}
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Cover Image</label>
            <label className="block cursor-pointer">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              />
              {coverFile ? (
                <div className="h-28 rounded-xl overflow-hidden relative">
                  <img src={URL.createObjectURL(coverFile)} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-2 right-2 bg-surface/90 px-2 py-1 rounded-lg text-[0.65rem] font-bold">Change</span>
                </div>
              ) : (
                <div className="h-28 rounded-xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center text-on-surface-variant hover:border-brand hover:text-brand transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>add_photo_alternate</span>
                  <span className="text-xs font-semibold mt-1">Upload (optional)</span>
                </div>
              )}
            </label>
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Title</label>
            <input className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant outline-none focus:border-brand text-sm text-on-surface transition-colors" placeholder="e.g. Advanced Calculus" value={newCourse.title} onChange={e => setNewCourse(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Description</label>
            <textarea className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant outline-none focus:border-brand text-sm text-on-surface resize-none h-20 transition-colors" placeholder="Course description…" value={newCourse.description} onChange={e => setNewCourse(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Total Lectures</label>
              <input type="number" min={1} className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant outline-none focus:border-brand text-sm text-on-surface transition-colors" value={newCourse.total_lectures} onChange={e => setNewCourse(p => ({ ...p, total_lectures: +e.target.value }))} />
            </div>
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Semester</label>
              <select className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant outline-none focus:border-brand text-sm text-on-surface transition-colors" value={newCourse.semester_id} onChange={e => setNewCourse(p => ({ ...p, semester_id: e.target.value }))}>
                <option value="">Select…</option>
                {semesters.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl border border-outline-variant hover:bg-surface-container transition-colors">Discard</button>
          <button onClick={handleCreateCourse} disabled={!newCourse.title || creating} className="px-5 py-2.5 text-sm font-bold bg-primary text-on-primary rounded-xl shadow-sm hover:opacity-90 transition-all disabled:opacity-50">{creating ? 'Creating…' : 'Create Course'}</button>
        </div>
      </Modal>

      {/* Create Semester Modal */}
      <Modal open={showSemesterModal} onClose={() => setShowSemesterModal(false)} maxWidth="md">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-on-surface">New Semester</h3>
          <button onClick={() => setShowSemesterModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '1.3rem' }}>close</span>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Title</label>
            <input className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant outline-none focus:border-brand text-sm text-on-surface transition-colors" placeholder="e.g. Fall 2026" value={newSemester.title} onChange={e => setNewSemester(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Start Date</label>
              <input type="date" className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant outline-none focus:border-brand text-sm text-on-surface transition-colors" value={newSemester.start_date} onChange={e => setNewSemester(p => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">End Date</label>
              <input type="date" className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant outline-none focus:border-brand text-sm text-on-surface transition-colors" value={newSemester.end_date} onChange={e => setNewSemester(p => ({ ...p, end_date: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={() => setShowSemesterModal(false)} className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl border border-outline-variant hover:bg-surface-container transition-colors">Discard</button>
          <button onClick={handleCreateSemester} disabled={!newSemester.title} className="px-5 py-2.5 text-sm font-bold bg-primary text-on-primary rounded-xl shadow-sm hover:opacity-90 transition-all disabled:opacity-50">Create Semester</button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
