import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '../components/DashboardLayout';
import { DashboardContentSkeleton } from '../components/Skeleton';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { studentNav } from '../lib/nav';
import { formatPKT, formatCET, useCountdown, isJoinable } from '../lib/time';

interface Course {
  id: string;
  title: string;
  total_lectures: number;
  completed_lectures: number;
  is_archived: boolean;
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

interface Quiz { id: string; status: string; }

function ProgressRing({ progress, size = 80 }: { progress: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth="6" fill="none" className="text-surface-container" />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke="currentColor" strokeWidth="6" fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        className="text-primary transition-all duration-700"
      />
    </svg>
  );
}

export default function StudentDashboard() {
  const { profile } = useAppStore();
  const firstName = profile?.full_name?.split(' ')[0] || 'Student';

  const { data: courses = [], isPending: cPending } = useQuery<Course[]>({
    queryKey: ['dashboard', 'student', 'courses'],
    queryFn: async () => (await supabase.from('courses').select('*').eq('is_archived', false)).data ?? [],
  });
  const { data: sessions = [], isPending: sPending } = useQuery<Session[]>({
    queryKey: ['dashboard', 'student', 'sessions'],
    queryFn: async () => (await supabase.from('sessions').select('*').order('scheduled_at', { ascending: true })).data ?? [],
  });
  const { data: quizzes = [], isPending: qPending } = useQuery<Quiz[]>({
    queryKey: ['dashboard', 'student', 'quizzes'],
    queryFn: async () => (await supabase.from('quizzes').select('id, status')).data ?? [],
  });
  const dashboardLoading = cPending || sPending || qPending;

  const courseTitleMap = useMemo(() => Object.fromEntries(courses.map(c => [c.id, c.title])), [courses]);
  const now = new Date();
  const upcoming = sessions.filter(s => s.status === 'scheduled' && new Date(s.scheduled_at) > now);
  const recent = sessions.filter(s => s.status === 'completed').slice(-5).reverse();
  const next = upcoming[0];
  const countdown = useCountdown(next?.scheduled_at ?? null);
  const pendingQuizzes = quizzes.filter(q => q.status === 'pending');
  const joinable = next ? isJoinable(next.scheduled_at, next.duration_min) : false;

  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  if (dashboardLoading) {
    return (
      <DashboardLayout title="Student Dashboard" navItems={studentNav}>
        <DashboardContentSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Student Dashboard" navItems={studentNav}>
      <div className="space-y-8 max-w-6xl mx-auto">

        <section>
          <h2 className="text-2xl font-extrabold text-primary tracking-tight">
            {greeting}, {firstName} ☀️
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            {pendingQuizzes.length > 0
              ? `You have ${pendingQuizzes.length} pending quiz${pendingQuizzes.length === 1 ? '' : 'zes'} to complete.`
              : 'All caught up! Keep up the great work.'}
          </p>
        </section>

        {/* Upcoming Session Hero Card */}
        {next ? (
          <section className="relative overflow-hidden academic-gradient rounded-2xl p-7 md:p-8 text-white">
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/5 rounded-full pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-white/5 rounded-full pointer-events-none" />

            <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center relative z-10">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-[0.65rem] font-bold uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Next Session
                </span>
                <div>
                  <p className="text-white/60 text-xs font-bold uppercase tracking-widest">{courseTitleMap[next.course_id]}</p>
                  <h3 className="text-xl font-extrabold text-white mt-1">{next.title}</h3>
                </div>
                {/* Dual-timezone display */}
                <div className="flex flex-wrap gap-5">
                  <div>
                    <p className="text-white/40 text-[0.6rem] uppercase tracking-widest font-bold">PKT (Teacher)</p>
                    <p className="text-white font-bold text-sm">{formatPKT(next.scheduled_at)}</p>
                  </div>
                  <div className="w-px bg-white/20 self-stretch" />
                  <div>
                    <p className="text-white/40 text-[0.6rem] uppercase tracking-widest font-bold">CET / CEST (You)</p>
                    <p className="text-white font-bold text-sm">{formatCET(next.scheduled_at)}</p>
                  </div>
                </div>

                {/* Countdown */}
                <div className="flex gap-3 pt-2">
                  {[
                    { label: 'Days', value: countdown.days },
                    { label: 'Hours', value: countdown.hours },
                    { label: 'Min', value: countdown.minutes },
                    { label: 'Sec', value: countdown.seconds },
                  ].map((c) => (
                    <div key={c.label} className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 min-w-[56px] text-center">
                      <p className="text-lg font-extrabold text-white leading-none">{String(c.value).padStart(2, '0')}</p>
                      <p className="text-[0.55rem] uppercase tracking-widest text-white/50 mt-1 font-bold">{c.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 shrink-0">
                {next.zoom_link && joinable ? (
                  <a
                    href={next.zoom_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-7 py-3.5 bg-white text-primary font-black rounded-xl hover:bg-slate-50 transition-colors text-sm shadow-lg"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>video_call</span>
                    Join Zoom Call
                  </a>
                ) : (
                  <div className="flex items-center gap-2 px-7 py-3.5 bg-white/10 text-white/70 font-bold rounded-xl text-sm border border-white/20 cursor-not-allowed">
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>lock_clock</span>
                    Opens 15 min before
                  </div>
                )}
                <Link to="/student/sessions" className="flex items-center justify-center gap-2 px-7 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-colors border border-white/20">
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>event</span>
                  View All Sessions
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-surface-container-lowest rounded-2xl p-10 text-center border border-outline-variant/10">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-2 block">event_available</span>
            <p className="text-sm text-on-surface-variant font-medium">No upcoming sessions scheduled.</p>
          </section>
        )}

        {/* Course Progress Rings */}
        <section>
          <h3 className="text-lg font-extrabold text-primary mb-5 tracking-tight">Course Progress</h3>
          {courses.length === 0 ? (
            <p className="text-sm text-on-surface-variant italic">You're not enrolled in any courses yet.</p>
          ) : (
            <div className="grid sm:grid-cols-3 gap-5">
              {courses.map((c) => {
                const pct = c.total_lectures > 0 ? Math.round((c.completed_lectures / c.total_lectures) * 100) : 0;
                return (
                  <Link key={c.id} to={`/student/courses/${c.id}`} className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10 flex items-center gap-5 hover:shadow-sm transition-shadow">
                    <div className="relative shrink-0">
                      <ProgressRing progress={pct} size={78} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-extrabold text-primary">{pct}%</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-on-surface text-sm leading-snug truncate">{c.title}</h4>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {c.completed_lectures} / {c.total_lectures} lectures
                      </p>
                      <div className="mt-2">
                        <span
                          className={`text-[0.6rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                            pct >= 80 ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
                          }`}
                        >
                          {pct >= 80 ? 'Nearly Done' : 'In Progress'}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: 'folder', label: 'Documents', to: '/student/documents', color: 'text-surface-tint bg-surface-tint/10' },
            { icon: 'quiz', label: 'Quizzes', to: '/student/quizzes', color: 'text-error bg-error/10' },
            { icon: 'history', label: 'Past Sessions', to: '/student/sessions', color: 'text-secondary bg-secondary/10' },
            { icon: 'notifications', label: 'Notifications', to: '/student/notifications', color: 'text-primary bg-primary/10' },
          ].map((q) => (
            <Link
              key={q.label}
              to={q.to}
              className="bg-surface-container-lowest rounded-2xl p-5 flex flex-col items-center gap-3 text-center hover:shadow-sm transition-shadow border border-outline-variant/10 group"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${q.color}`}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>{q.icon}</span>
              </div>
              <span className="text-xs font-bold text-on-surface">{q.label}</span>
            </Link>
          ))}
        </div>

        {/* Recent Sessions */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-extrabold text-primary tracking-tight">Recent Sessions</h3>
            <Link to="/student/sessions" className="text-xs font-bold text-surface-tint hover:underline">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-on-surface-variant italic">No completed sessions yet.</p>
          ) : (
            <div className="space-y-3">
              {recent.map((s) => (
                <div key={s.id} className="bg-surface-container-lowest rounded-2xl px-6 py-4 flex items-center gap-5 border border-outline-variant/10 hover:border-outline-variant/30 transition-all">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: '1.1rem' }}>play_circle</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-secondary/60 uppercase tracking-widest">{courseTitleMap[s.course_id]}</p>
                    <p className="text-sm font-bold text-on-surface truncate mt-0.5">{s.title}</p>
                  </div>
                  <div className="hidden sm:flex flex-col items-end text-xs text-on-surface-variant">
                    <span>{new Date(s.scheduled_at).toLocaleDateString()}</span>
                    <span className="font-semibold mt-0.5">{s.duration_min} min</span>
                  </div>
                  <span className="text-[0.6rem] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                    completed
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </DashboardLayout>
  );
}
