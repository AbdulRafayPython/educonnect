export interface NavItem {
  icon: string;
  label: string;
  to: string;
}

// Mode A (1:1 Private Track) teacher nav. Crossing into Mode B is done via the
// TeacherModeSwitcher in the sidebar, not a nav entry.
export const teacherNav: NavItem[] = [
  { icon: 'dashboard', label: 'Dashboard', to: '/teacher/dashboard' },
  { icon: 'school', label: 'Courses', to: '/teacher/courses' },
  { icon: 'event', label: 'Sessions', to: '/teacher/sessions' },
  { icon: 'description', label: 'Documents', to: '/teacher/documents' },
  { icon: 'slideshow', label: 'Slides', to: '/teacher/slides' },
  { icon: 'quiz', label: 'Quizzes', to: '/teacher/quizzes' },
  { icon: 'feed', label: 'AI Feed', to: '/teacher/feed' },
  { icon: 'group', label: 'Students', to: '/teacher/students' },
  { icon: 'notifications', label: 'Notifications', to: '/teacher/notifications' },
  { icon: 'settings', label: 'Settings', to: '/teacher/settings' },
];

// Mode B (AI Masterclass Hub) teacher admin nav.
export const teacherMasterclassNav: NavItem[] = [
  { icon: 'dashboard', label: 'Overview', to: '/teacher/masterclass' },
  { icon: 'groups', label: 'Cohorts', to: '/teacher/masterclass/cohorts' },
  { icon: 'event', label: 'Sessions', to: '/teacher/masterclass/sessions' },
  { icon: 'quiz', label: 'Quizzes', to: '/teacher/masterclass/quizzes' },
  { icon: 'notifications', label: 'Notifications', to: '/teacher/notifications' },
  { icon: 'settings', label: 'Settings', to: '/teacher/settings' },
];

// Which teacher nav to show, derived from the current path so the sidebar and
// the mode switcher always agree.
export const teacherNavForPath = (pathname: string): NavItem[] =>
  pathname.startsWith('/teacher/masterclass') ? teacherMasterclassNav : teacherNav;

export const studentNav: NavItem[] = [
  { icon: 'dashboard', label: 'Dashboard', to: '/student/dashboard' },
  { icon: 'school', label: 'My Courses', to: '/student/courses' },
  { icon: 'event', label: 'Sessions', to: '/student/sessions' },
  { icon: 'description', label: 'Documents', to: '/student/documents' },
  { icon: 'slideshow', label: 'Slides', to: '/student/slides' },
  { icon: 'quiz', label: 'Quizzes', to: '/student/quizzes' },
  { icon: 'feed', label: 'AI Feed', to: '/student/feed' },
  { icon: 'notifications', label: 'Notifications', to: '/student/notifications' },
  { icon: 'settings', label: 'Settings', to: '/student/settings' },
];

// Mode B (AI Masterclass Hub) — student_group cousins.
// Only routes that exist are listed (no dead links). Quizzes/Progress/Feed
// arrive in later phases and get added here as they land.
export const masterclassNav: NavItem[] = [
  { icon: 'dashboard', label: 'Home', to: '/masterclass' },
  { icon: 'event', label: 'Sessions', to: '/masterclass/sessions' },
  { icon: 'quiz', label: 'Quizzes', to: '/masterclass/quizzes' },
  { icon: 'trending_up', label: 'Progress', to: '/masterclass/progress' },
  { icon: 'feed', label: 'AI Feed', to: '/masterclass/feed' },
  { icon: 'settings', label: 'Settings', to: '/masterclass/settings' },
];
// Note: the mobile bottom tab bar caps at the first 4 (PRD §8.5 — the core
// learning loop); Feed + Settings live in the desktop sidebar and the Home hub.

export type Role = 'teacher' | 'student' | 'student_group' | null;

export const navForRole = (role: Role) =>
  role === 'teacher' ? teacherNav : role === 'student_group' ? masterclassNav : studentNav;

// Feed link bases — the AI feed is shared by all roles but lives under each
// role's own route prefix (PRD §13). Keeps FeedCard links role-correct.
export const feedBasePath = (role: Role): string =>
  role === 'teacher' ? '/teacher/feed/view' : role === 'student_group' ? '/masterclass/feed' : '/student/feed';
export const feedSavedPath = (role: Role): string =>
  role === 'student_group' ? '/masterclass/feed/saved' : '/student/feed/saved';

// Canonical landing route for a role. Used by route guards and post-login
// redirects so the three role spaces never cross-bounce into a redirect loop.
export const roleHome = (role: Role): string =>
  role === 'teacher'
    ? '/teacher/dashboard'
    : role === 'student_group'
      ? '/masterclass'
      : '/student/dashboard';
