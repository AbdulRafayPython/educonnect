import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { navForRole } from '../lib/nav';
import { formatPKT, formatCET } from '../lib/time';

interface Course {
  id: string;
  title: string;
  description: string;
  total_lectures: number;
  completed_lectures: number;
  is_archived: boolean;
  semester_id: string;
  created_at: string;
}

interface Session {
  id: string;
  title: string;
  scheduled_at: string;
  duration_min: number;
  status: string;
  zoom_link: string;
  summary: string;
}

interface Doc { id: string; title: string; tag: string; file_path: string; file_type: string; created_at: string; }
interface Quiz { id: string; title: string; type: string; status: string; due_date: string; }

const statusIcons: Record<string, string> = {
  scheduled: 'schedule',
  in_progress: 'play_circle',
  completed: 'check_circle',
  cancelled: 'cancel',
};
const statusColors: Record<string, string> = {
  scheduled: 'text-primary',
  in_progress: 'text-amber-600',
  completed: 'text-emerald-600',
  cancelled: 'text-error',
};

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAppStore();
  const nav = navForRole(role);

  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalDraft, setTotalDraft] = useState(0);

  useEffect(() => { if (id) load(); }, [id]);

  const load = async () => {
    setLoading(true);
    const [cRes, sRes, dRes, qRes] = await Promise.all([
      supabase.from('courses').select('*').eq('id', id!).single(),
      supabase.from('sessions').select('*').eq('course_id', id!).order('scheduled_at', { ascending: true }),
      supabase.from('documents').select('*').eq('course_id', id!).order('created_at', { ascending: false }),
      supabase.from('quizzes').select('*').eq('course_id', id!).order('created_at', { ascending: false }),
    ]);
    if (cRes.data) { setCourse(cRes.data); setTotalDraft(cRes.data.total_lectures); }
    if (sRes.data) setSessions(sRes.data);
    if (dRes.data) setDocs(dRes.data);
    if (qRes.data) setQuizzes(qRes.data);
    setLoading(false);
  };

  const saveTotal = async () => {
    await supabase.from('courses').update({ total_lectures: totalDraft }).eq('id', id!);
    setEditingTotal(false);
    load();
  };

  const downloadDoc = async (filePath: string, title: string) => {
    const { data } = await supabase.storage.from('documents').createSignedUrl(filePath, 60);
    if (data?.signedUrl) {
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = title;
      a.click();
    }
  };

  if (loading) {
    return <DashboardLayout title="Course" navItems={nav}><div className="text-center py-20 text-on-surface-variant">Loading…</div></DashboardLayout>;
  }
  if (!course) {
    return <DashboardLayout title="Course" navItems={nav}><div className="text-center py-20 text-on-surface-variant">Course not found.</div></DashboardLayout>;
  }

  const pct = course.total_lectures > 0 ? Math.round((course.completed_lectures / course.total_lectures) * 100) : 0;
  const remaining = Math.max(0, course.total_lectures - course.completed_lectures);

  // Estimated completion date based on session frequency
  const completedSessions = sessions.filter(s => s.status === 'completed');
  let etaText = 'Insufficient data';
  if (completedSessions.length >= 2 && remaining > 0) {
    const sorted = completedSessions.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    const first = new Date(sorted[0].scheduled_at).getTime();
    const last = new Date(sorted[sorted.length - 1].scheduled_at).getTime();
    const avgGap = (last - first) / (sorted.length - 1);
    const eta = new Date(Date.now() + avgGap * remaining);
    etaText = eta.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else if (remaining === 0) {
    etaText = 'Complete!';
  }

  const backTo = role === 'teacher' ? '/teacher/courses' : '/student/courses';

  return (
    <DashboardLayout title={course.title} navItems={nav}>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Back */}
        <button onClick={() => navigate(backTo)} className="flex items-center gap-1 text-xs font-bold text-secondary hover:text-primary transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_back</span>
          Back to Courses
        </button>

        {/* Course Header */}
        <section className="academic-gradient rounded-2xl p-8 text-white relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between">
            <div className="space-y-2 max-w-2xl">
              <span className="text-[0.65rem] font-black uppercase tracking-widest text-white/50">Course</span>
              <h2 className="text-3xl font-extrabold">{course.title}</h2>
              <p className="text-white/70 text-sm leading-relaxed">{course.description || 'No description.'}</p>
            </div>
            <div className="shrink-0 bg-white/10 backdrop-blur-sm rounded-2xl p-5 min-w-[200px]">
              <p className="text-[0.6rem] uppercase tracking-widest text-white/50 font-bold">Progress</p>
              <p className="text-3xl font-extrabold mt-1">{pct}%</p>
              <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden mt-3">
                <div className="bg-white h-full rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-white/70 mt-2">{course.completed_lectures} / {course.total_lectures} lectures</p>
              <p className="text-[0.6rem] uppercase tracking-widest text-white/40 mt-3 font-bold">Estimated completion</p>
              <p className="text-sm font-bold mt-0.5">{etaText}</p>
            </div>
          </div>
        </section>

        {/* Total lectures override (teacher only) */}
        {role === 'teacher' && (
          <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 flex items-center justify-between gap-4">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant">Total Lectures Planned</p>
              {editingTotal ? (
                <div className="flex items-center gap-2 mt-2">
                  <input type="number" min={1} value={totalDraft} onChange={e => setTotalDraft(+e.target.value)} className="px-3 py-2 rounded-xl bg-surface-variant/40 border-none outline-none text-sm w-24" />
                  <button onClick={saveTotal} className="px-4 py-2 academic-gradient text-white text-xs font-bold rounded-xl">Save</button>
                  <button onClick={() => { setEditingTotal(false); setTotalDraft(course.total_lectures); }} className="px-3 py-2 text-xs font-bold text-secondary">Cancel</button>
                </div>
              ) : (
                <p className="text-2xl font-extrabold text-primary mt-1">{course.total_lectures}</p>
              )}
            </div>
            {!editingTotal && (
              <button onClick={() => setEditingTotal(true)} className="px-4 py-2 bg-surface-container text-primary text-xs font-bold rounded-xl hover:bg-surface-container-high transition-all">Override</button>
            )}
          </div>
        )}

        {/* Lectures Accordion */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-extrabold text-primary tracking-tight">Lectures</h3>
            <span className="text-xs text-on-surface-variant">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
          </div>
          {sessions.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl p-8 text-center text-sm text-on-surface-variant border border-outline-variant/10">
              No lectures scheduled for this course yet.
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s, i) => (
                <div key={s.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
                  <button onClick={() => setOpenSession(openSession === s.id ? null : s.id)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-container/30 transition-colors text-left">
                    <span className={`material-symbols-outlined ${statusColors[s.status]}`} style={{ fontSize: '1.4rem' }}>{statusIcons[s.status]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/60">Lecture {i + 1}</p>
                      <p className="font-bold text-on-surface text-sm truncate">{s.title}</p>
                    </div>
                    <div className="hidden sm:block text-xs text-on-surface-variant text-right">
                      <p>{formatPKT(s.scheduled_at, false)}</p>
                      <p className="text-secondary/70">{formatCET(s.scheduled_at, false)}</p>
                    </div>
                    <span className="material-symbols-outlined text-secondary/50">{openSession === s.id ? 'expand_less' : 'expand_more'}</span>
                  </button>
                  {openSession === s.id && (
                    <div className="px-5 pb-5 pt-1 border-t border-outline-variant/10 space-y-3 bg-surface-container-low/30">
                      <div className="grid sm:grid-cols-2 gap-3 pt-3 text-xs">
                        <div>
                          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/60">PKT</p>
                          <p className="font-bold text-on-surface">{formatPKT(s.scheduled_at)}</p>
                        </div>
                        <div>
                          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/60">CET / CEST</p>
                          <p className="font-bold text-on-surface">{formatCET(s.scheduled_at)}</p>
                        </div>
                      </div>
                      {s.summary && (
                        <div className="pt-2">
                          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/60 mb-1">Summary</p>
                          <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap">{s.summary}</p>
                        </div>
                      )}
                      {s.zoom_link && (
                        <a href={s.zoom_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                          <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>video_call</span>
                          Zoom Link
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Documents */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-extrabold text-primary tracking-tight">Documents</h3>
            <Link to={role === 'teacher' ? '/teacher/documents' : '/student/documents'} className="text-xs font-bold text-surface-tint hover:underline">View all →</Link>
          </div>
          {docs.length === 0 ? (
            <p className="text-sm text-on-surface-variant italic">No documents attached.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {docs.map(d => (
                <button key={d.id} onClick={() => downloadDoc(d.file_path, d.title)} className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/10 flex items-center gap-3 hover:shadow-sm transition-shadow text-left">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>description</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">{d.title}</p>
                    <p className="text-[0.65rem] uppercase tracking-widest text-secondary/60 font-bold">{d.tag} · {d.file_type}</p>
                  </div>
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: '1.1rem' }}>download</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Quizzes */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-extrabold text-primary tracking-tight">Quizzes & Challenges</h3>
            <Link to={role === 'teacher' ? '/teacher/quizzes' : '/student/quizzes'} className="text-xs font-bold text-surface-tint hover:underline">View all →</Link>
          </div>
          {quizzes.length === 0 ? (
            <p className="text-sm text-on-surface-variant italic">No quizzes attached.</p>
          ) : (
            <div className="space-y-2">
              {quizzes.map(q => (
                <div key={q.id} className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/10 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>quiz</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface">{q.title}</p>
                    <p className="text-[0.65rem] uppercase tracking-widest text-secondary/60 font-bold">{q.type} · {q.status}</p>
                  </div>
                  {q.due_date && (
                    <span className="text-[0.65rem] font-bold text-on-surface-variant">Due {new Date(q.due_date).toLocaleDateString()}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
