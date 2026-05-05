import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAppStore } from './store/useAppStore';

import Login from './pages/Login';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import Sessions from './pages/Sessions';
import Documents from './pages/Documents';
import Slides from './pages/Slides';
import SlideViewer from './pages/SlideViewer';
import Quizzes from './pages/Quizzes';
import Notifications from './pages/Notifications';
import Students from './pages/Students';
import Settings from './pages/Settings';

function App() {
  const { user, role, setUser, setProfile, isLoading, setIsLoading } = useAppStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Keep the current user's profile in sync with realtime UPDATE events
  // so avatar/name changes propagate across tabs and components.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`profile-self-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${user.id}`,
      }, (payload) => {
        if (payload.new) setProfile(payload.new);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="w-12 h-12 academic-gradient rounded-2xl flex items-center justify-center shadow-xl">
          <span className="material-symbols-outlined text-white animate-pulse" style={{ fontSize: '1.5rem' }}>school</span>
        </div>
        <p className="text-sm font-bold text-primary/60 uppercase tracking-widest">Loading…</p>
      </div>
    );
  }

  const teacherGuard = (el: React.ReactNode) => user && role === 'teacher' ? el : <Navigate to="/login" replace />;
  const studentGuard = (el: React.ReactNode) => user && role === 'student' ? el : <Navigate to="/login" replace />;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to={role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'} replace />} />

        {/* Teacher Routes */}
        <Route path="/teacher/dashboard" element={teacherGuard(<TeacherDashboard />)} />
        <Route path="/teacher/courses" element={teacherGuard(<Courses />)} />
        <Route path="/teacher/courses/:id" element={teacherGuard(<CourseDetail />)} />
        <Route path="/teacher/sessions" element={teacherGuard(<Sessions />)} />
        <Route path="/teacher/documents" element={teacherGuard(<Documents />)} />
        <Route path="/teacher/slides" element={teacherGuard(<Slides />)} />
        <Route path="/teacher/slides/:id" element={teacherGuard(<SlideViewer />)} />
        <Route path="/teacher/quizzes" element={teacherGuard(<Quizzes />)} />
        <Route path="/teacher/students" element={teacherGuard(<Students />)} />
        <Route path="/teacher/notifications" element={teacherGuard(<Notifications />)} />
        <Route path="/teacher/settings" element={teacherGuard(<Settings />)} />

        {/* Student Routes */}
        <Route path="/student/dashboard" element={studentGuard(<StudentDashboard />)} />
        <Route path="/student/courses" element={studentGuard(<Courses />)} />
        <Route path="/student/courses/:id" element={studentGuard(<CourseDetail />)} />
        <Route path="/student/sessions" element={studentGuard(<Sessions />)} />
        <Route path="/student/documents" element={studentGuard(<Documents />)} />
        <Route path="/student/slides" element={studentGuard(<Slides />)} />
        <Route path="/student/slides/:id" element={studentGuard(<SlideViewer />)} />
        <Route path="/student/quizzes" element={studentGuard(<Quizzes />)} />
        <Route path="/student/notifications" element={studentGuard(<Notifications />)} />
        <Route path="/student/settings" element={studentGuard(<Settings />)} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
