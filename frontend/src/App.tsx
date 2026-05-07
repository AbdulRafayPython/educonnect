import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAppStore } from './store/useAppStore';

import AppShellSkeleton from './components/AppShellSkeleton';
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
import Feed from './pages/Feed';
import FeedDetail from './pages/FeedDetail';
import FeedSaved from './pages/FeedSaved';
import TeacherFeed from './pages/TeacherFeed';
import TeacherFeedSources from './pages/TeacherFeedSources';
import TeacherFeedConceptEditor from './pages/TeacherFeedConceptEditor';

function App() {
  const { user, role, setUser, setProfile, isLoading, setIsLoading } = useAppStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // If we already have a cached profile, mark loading complete immediately
        // so the dashboard renders. Re-fetch in the background to revalidate.
        if (useAppStore.getState().profile) {
          setIsLoading(false);
          fetchProfile(session.user.id);
        } else {
          fetchProfile(session.user.id);
        }
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        if (useAppStore.getState().profile) {
          setIsLoading(false);
          fetchProfile(session.user.id);
        } else {
          fetchProfile(session.user.id);
        }
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
    // If we know there's no user yet, show a small splash so the login page
    // doesn't flash a chrome-skeleton. If we already have a user (returning
    // session), show the full app-shell skeleton — feels instant.
    if (!user) {
      return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background gap-4">
          <div className="w-12 h-12 academic-gradient rounded-2xl flex items-center justify-center shadow-xl">
            <span className="material-symbols-outlined text-white animate-pulse" style={{ fontSize: '1.5rem' }}>school</span>
          </div>
          <p className="text-sm font-bold text-primary/60 uppercase tracking-widest">Loading…</p>
        </div>
      );
    }
    return <AppShellSkeleton />;
  }

  // While the user is authenticated but the profile/role is still resolving,
  // show the app-shell skeleton instead of bouncing through guards. This
  // prevents a brief blank page right after sign-in (user set, role null) where
  // /login → dashboard → /login redirects produce no visible UI.
  const teacherGuard = (el: React.ReactNode) => {
    if (!user) return <Navigate to="/login" replace />;
    if (!role) return <AppShellSkeleton />;
    return role === 'teacher' ? el : <Navigate to="/student/dashboard" replace />;
  };
  const studentGuard = (el: React.ReactNode) => {
    if (!user) return <Navigate to="/login" replace />;
    if (!role) return <AppShellSkeleton />;
    return role === 'student' ? el : <Navigate to="/teacher/dashboard" replace />;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : (role ? <Navigate to={role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'} replace /> : <AppShellSkeleton />)} />

        {/* Teacher Routes */}
        <Route path="/teacher/dashboard" element={teacherGuard(<TeacherDashboard />)} />
        <Route path="/teacher/courses" element={teacherGuard(<Courses />)} />
        <Route path="/teacher/courses/:id" element={teacherGuard(<CourseDetail />)} />
        <Route path="/teacher/sessions" element={teacherGuard(<Sessions />)} />
        <Route path="/teacher/documents" element={teacherGuard(<Documents />)} />
        <Route path="/teacher/slides" element={teacherGuard(<Slides />)} />
        <Route path="/teacher/slides/:id" element={teacherGuard(<SlideViewer />)} />
        <Route path="/teacher/quizzes" element={teacherGuard(<Quizzes />)} />
        <Route path="/teacher/feed" element={teacherGuard(<TeacherFeed />)} />
        <Route path="/teacher/feed/sources" element={teacherGuard(<TeacherFeedSources />)} />
        <Route path="/teacher/feed/new" element={teacherGuard(<TeacherFeedConceptEditor />)} />
        <Route path="/teacher/feed/edit/:id" element={teacherGuard(<TeacherFeedConceptEditor />)} />
        <Route path="/teacher/feed/view/:id" element={teacherGuard(<FeedDetail />)} />
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
        <Route path="/student/feed" element={studentGuard(<Feed />)} />
        <Route path="/student/feed/saved" element={studentGuard(<FeedSaved />)} />
        <Route path="/student/feed/:id" element={studentGuard(<FeedDetail />)} />
        <Route path="/student/notifications" element={studentGuard(<Notifications />)} />
        <Route path="/student/settings" element={studentGuard(<Settings />)} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
