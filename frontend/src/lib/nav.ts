export interface NavItem {
  icon: string;
  label: string;
  to: string;
}

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

export const navForRole = (role: 'teacher' | 'student' | null) =>
  role === 'teacher' ? teacherNav : studentNav;
