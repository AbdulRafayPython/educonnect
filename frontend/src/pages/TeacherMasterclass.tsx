import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { teacherNav } from '../lib/nav';
import { supabase } from '../lib/supabase';

/** Mode B admin hub (PRD §16 `/admin/masterclass`, served here under /teacher). */
export default function TeacherMasterclass() {
  const [counts, setCounts] = useState({ students: 0, cohorts: 0, sessions: 0, quizzes: 0 });

  useEffect(() => {
    (async () => {
      const [students, cohorts, sessions, quizzes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student_group'),
        supabase.from('cohorts').select('id', { count: 'exact', head: true }),
        supabase.from('masterclass_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('masterclass_quizzes').select('id', { count: 'exact', head: true }),
      ]);
      setCounts({
        students: students.count ?? 0,
        cohorts: cohorts.count ?? 0,
        sessions: sessions.count ?? 0,
        quizzes: quizzes.count ?? 0,
      });
    })();
  }, []);

  const cards = [
    { to: '/teacher/masterclass/cohorts', icon: 'groups', title: 'Cohorts', desc: 'Roster & progress per student', stat: `${counts.students} student${counts.students !== 1 ? 's' : ''} · ${counts.cohorts} cohort${counts.cohorts !== 1 ? 's' : ''}`, live: true },
    { to: '/teacher/masterclass/sessions', icon: 'event', title: 'Sessions', desc: '12-week schedule & generator', stat: `${counts.sessions} session${counts.sessions !== 1 ? 's' : ''}`, live: true },
    { to: '/teacher/masterclass/quizzes', icon: 'quiz', title: 'Quizzes', desc: 'Knowledge checks & challenges', stat: `${counts.quizzes} quiz${counts.quizzes !== 1 ? 'zes' : ''}`, live: true },
    { to: '#', icon: 'campaign', title: 'Broadcast', desc: 'Email a cohort or everyone', stat: 'Coming in Phase 4', live: false },
  ];

  return (
    <DashboardLayout title="AI Masterclass" navItems={teacherNav}>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-extrabold text-primary tracking-tight">AI Masterclass Hub</h2>
          <p className="text-on-surface-variant text-sm mt-1">Manage the Zero to Hero AI Sessions program.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {cards.map((c) => {
            const inner = (
              <>
                <div className="flex items-start justify-between">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: '1.4rem' }}>{c.icon}</span>
                  </div>
                  {!c.live && <span className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50 bg-surface-container px-2 py-1 rounded-full">Soon</span>}
                </div>
                <h3 className="font-bold text-on-surface text-base mt-4">{c.title}</h3>
                <p className="text-sm text-on-surface-variant mt-0.5">{c.desc}</p>
                <p className="text-xs font-bold text-primary/70 mt-3 uppercase tracking-wider">{c.stat}</p>
              </>
            );
            return c.live ? (
              <Link key={c.title} to={c.to} className="block bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-6 hover-lift hover:border-outline-variant/25 transition-all">
                {inner}
              </Link>
            ) : (
              <div key={c.title} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-6 opacity-60">
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
