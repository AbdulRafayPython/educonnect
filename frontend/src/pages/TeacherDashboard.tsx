import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { teacherNav } from '../lib/nav';
import { formatPKT, useCountdown, isJoinable } from '../lib/time';

interface Stat {
  label: string;
  value: string;
  sub: string;
  icon: string;
  accent: string;
}

interface Session {
  id: string;
  course_id: string;
  title: string;
  scheduled_at: string;
  duration_min: number;
  zoom_link: string;
  status: string;
}

interface Course {
  id: string;
  title: string;
  total_lectures: number;
  completed_lectures: number;
  is_archived: boolean;
}

interface Quiz { id: string; title: string; status: string; }
interface Notif { id: string; title: string; body: string; created_at: string; type: string; }

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { profile } = useAppStore();
  const firstName = profile?.full_name?.split(' ')[0] || 'Professor';

  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [recentNotifs, setRecentNotifs] = useState<Notif[]>([]);

  useEffect(() => {
    (async () => {
      const [c, s, q, n] = await Promise.all([
        supabase.from('courses').select('*').eq('is_archived', false),
        supabase.from('sessions').select('*').order('scheduled_at', { ascending: true }),
        supabase.from('quizzes').select('id, title, status'),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(5),
      ]);
      if (c.data) setCourses(c.data);
      if (s.data) setSessions(s.data);
      if (q.data) setQuizzes(q.data);
      if (n.data) setRecentNotifs(n.data);
    })();
  }, []);

  const now = new Date();
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 7);

  const upcoming = sessions.filter(s => new Date(s.scheduled_at) > now && s.status === 'scheduled');
  const thisWeek = sessions.filter(s => {
    const d = new Date(s.scheduled_at);
    return d >= startOfWeek && d < endOfWeek;
  });
  const todays = sessions.filter(s => {
    const d = new Date(s.scheduled_at);
    return d.toDateString() === now.toDateString();
  });
  const nextSession = upcoming[0];
  const pendingQuizzes = quizzes.filter(q => q.status === 'submitted');

  const stats: Stat[] = [
    { label: 'Total Courses', value: String(courses.length).padStart(2, '0'), sub: 'Active in current semester', icon: 'book', accent: 'bg-surface-tint/10 text-surface-tint' },
    { label: 'Sessions This Week', value: String(thisWeek.length).padStart(2, '0'), sub: 'Mon–Sun schedule', icon: 'calendar_today', accent: 'bg-secondary/10 text-secondary' },
    { label: 'Upcoming Sessions', value: String(upcoming.length).padStart(2, '0'), sub: nextSession ? `Next: ${formatPKT(nextSession.scheduled_at, false)}` : 'None scheduled', icon: 'video_call', accent: 'bg-primary/10 text-primary' },
    { label: 'Pending Quizzes', value: String(pendingQuizzes.length).padStart(2, '0'), sub: 'Awaiting your review', icon: 'rule', accent: 'bg-error/10 text-error' },
  ];

  const courseTitleMap = useMemo(() => Object.fromEntries(courses.map(c => [c.id, c.title])), [courses]);
  const countdown = useCountdown(nextSession?.scheduled_at ?? null);

  return (
    <DashboardLayout title="Teacher Dashboard" navItems={teacherNav}>
      <div className="space-y-10 max-w-7xl mx-auto">

        {/* Welcome */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5 pb-8 border-b border-outline-variant/30">
          <div>
            <h2 className="text-3xl font-extrabold text-primary tracking-tight mb-2">
              Welcome back, {firstName} 👋
            </h2>
            <p className="text-on-surface-variant text-sm leading-relaxed max-w-lg">
              {pendingQuizzes.length > 0
                ? `You have ${pendingQuizzes.length} quiz submission${pendingQuizzes.length === 1 ? '' : 's'} waiting to be graded.`
                : 'All caught up! No pending grading.'}
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <button onClick={() => navigate('/teacher/documents')} className="flex items-center gap-2 px-4 py-2.5 bg-surface-container text-primary font-bold text-sm rounded-xl hover:bg-surface-container-high transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>file_upload</span>
              Upload Document
            </button>
            <button onClick={() => navigate('/teacher/courses')} className="flex items-center gap-2 px-4 py-2.5 academic-gradient text-white font-bold text-sm rounded-xl shadow-md hover:opacity-90 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
              Create Course
            </button>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[0.65rem] font-bold text-secondary uppercase tracking-widest leading-tight">{s.label}</span>
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${s.accent}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>{s.icon}</span>
                </span>
              </div>
              <p className="text-3xl font-extrabold text-primary">{s.value}</p>
              <p className="text-xs text-on-surface-variant mt-1.5">{s.sub}</p>
            </div>
          ))}
        </section>

        {/* Next Session Banner */}
        {nextSession && (
          <div className="relative overflow-hidden academic-gradient rounded-2xl p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/5 rounded-full pointer-events-none" />
            <div>
              <span className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-white/50">Next Teaching Session</span>
              <h3 className="text-white text-xl font-bold mt-1">{nextSession.title}</h3>
              <p className="text-white/60 text-sm mt-1">
                {courseTitleMap[nextSession.course_id] || 'Course'} · {countdown.expired
                  ? 'Starting now'
                  : `In ${countdown.days > 0 ? `${countdown.days}d ` : ''}${countdown.hours}h ${countdown.minutes}m`}
              </p>
            </div>
            {nextSession.zoom_link && (
              <a href={nextSession.zoom_link} target="_blank" rel="noopener noreferrer" className="shrink-0 z-10 flex items-center gap-2 px-7 py-3.5 bg-white text-primary font-black rounded-xl hover:bg-slate-50 transition-colors shadow-lg text-sm">
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>play_arrow</span>
                {isJoinable(nextSession.scheduled_at, nextSession.duration_min) ? 'JOIN NOW' : 'OPEN ZOOM'}
              </a>
            )}
          </div>
        )}

        {/* Schedule + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-extrabold text-primary tracking-tight">Today's Schedule</h3>
              <Link to="/teacher/sessions" className="text-xs font-bold text-surface-tint hover:underline">View All →</Link>
            </div>
            {todays.length === 0 ? (
              <div className="bg-surface-container-lowest rounded-2xl p-10 text-center border border-outline-variant/10">
                <span className="material-symbols-outlined text-4xl text-outline/30 mb-2 block">free_breakfast</span>
                <p className="text-sm text-on-surface-variant font-medium">No sessions scheduled for today.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {todays.map((s) => {
                  const d = new Date(s.scheduled_at);
                  return (
                    <div key={s.id} className="group bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 hover:border-outline-variant/30 transition-all">
                      <div className="flex gap-4 items-start">
                        <div className="bg-surface-container rounded-xl p-3 text-center min-w-[52px]">
                          <div className="text-[0.6rem] uppercase text-secondary/60 font-bold">{d.toLocaleString('en-US', { month: 'short' })}</div>
                          <div className="text-lg font-extrabold text-primary leading-none mt-0.5">{d.getDate()}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[0.6rem] font-black uppercase tracking-widest text-secondary">{courseTitleMap[s.course_id]?.split(' ').slice(0, 2).join(' ') || 'Session'}</span>
                          <h4 className="font-bold text-on-surface text-sm mt-1 truncate">{s.title}</h4>
                          <div className="flex items-center gap-3 mt-2 text-xs text-on-surface-variant font-medium">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>schedule</span>
                              {formatPKT(s.scheduled_at, false)}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>timer</span>
                              {s.duration_min}m
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-4 bg-surface-container-low rounded-2xl p-6 space-y-6 border border-outline-variant/10">
            <h3 className="font-extrabold text-primary text-base">Recent Activity</h3>
            <div className="space-y-6">
              {recentNotifs.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic">No activity yet.</p>
              ) : recentNotifs.map((a, i) => (
                <div key={a.id} className="relative pl-5 before:absolute before:left-1 before:top-3.5 before:bottom-0 before:w-px before:bg-outline-variant/40">
                  <div className={`absolute left-[-2px] top-1.5 w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-primary' : 'bg-secondary'} border-2 border-surface-container-low`} />
                  <p className="text-[0.6rem] font-bold text-secondary/60 uppercase tracking-widest mb-1">
                    {new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                  <p className="text-sm text-on-surface leading-snug font-bold">{a.title}</p>
                  <p className="text-xs text-on-surface-variant leading-snug">{a.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Active Courses */}
        <section>
          <div className="flex items-baseline justify-between mb-6">
            <h3 className="text-2xl font-extrabold text-primary tracking-tight">Your Active Courses</h3>
            <p className="text-sm text-on-surface-variant">{courses.length} in progress</p>
          </div>
          {courses.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl p-10 text-center border border-outline-variant/10">
              <span className="material-symbols-outlined text-5xl text-outline/30 mb-2 block">school</span>
              <p className="text-sm text-on-surface-variant font-medium">No courses yet.</p>
              <Link to="/teacher/courses" className="text-xs font-bold text-primary hover:underline mt-2 inline-block">Create your first course →</Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.slice(0, 6).map((c) => {
                const pct = c.total_lectures > 0 ? Math.round((c.completed_lectures / c.total_lectures) * 100) : 0;
                return (
                  <Link key={c.id} to={`/teacher/courses/${c.id}`} className="bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/10 flex flex-col hover:shadow-md transition-shadow">
                    <div className="h-28 relative academic-gradient flex items-end p-4">
                      <span className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[0.65rem] font-bold text-white">
                        {c.completed_lectures}/{c.total_lectures} lectures
                      </span>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h4 className="font-bold text-on-surface text-sm mb-3">{c.title}</h4>
                      <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden mb-2">
                        <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-secondary font-bold mt-auto pt-2">
                        <span>{pct}% Complete</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </DashboardLayout>
  );
}
