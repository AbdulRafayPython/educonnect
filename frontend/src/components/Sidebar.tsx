import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import type { NavItem } from '../lib/nav';
import TeacherModeSwitcher from './TeacherModeSwitcher';

interface SidebarProps {
  navItems: NavItem[];
  open?: boolean;
  onClose?: () => void;
}

const roleLabel: Record<string, string> = {
  teacher: 'School Admin',
  student: 'Student',
  student_group: 'Masterclass',
};

export default function Sidebar({ navItems, open = false, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const { setUser, setProfile, role, profile } = useAppStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    onClose?.();
    navigate('/login');
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  let lastSection: string | undefined;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={onClose}
        aria-hidden={!open}
        className={`fixed inset-0 bg-on-surface/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      <aside
        className={`fixed left-0 top-0 h-[100dvh] w-64 sm:w-60 flex flex-col bg-surface z-50 border-r border-outline-variant/60 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="px-5 sm:px-6 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 academic-gradient rounded-xl flex items-center justify-center shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-white" style={{ fontSize: '1.05rem' }}>school</span>
            </div>
            <span className="text-lg font-extrabold text-on-surface tracking-tight truncate">EduConnect</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>close</span>
          </button>
        </div>

        {role === 'teacher' && <TeacherModeSwitcher onNavigate={onClose} />}

        <nav className="flex-1 px-3 pb-2 space-y-0.5 overflow-y-auto overscroll-contain">
          {navItems.map((item) => {
            const showHeader = item.section && item.section !== lastSection;
            lastSection = item.section ?? lastSection;
            return (
              <div key={item.to}>
                {showHeader && (
                  <p className="px-3 pt-5 pb-1.5 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                    {item.section}
                  </p>
                )}
                <NavLink
                  to={item.to}
                  end={item.to.endsWith('/dashboard') || item.to === '/teacher/masterclass'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface active:bg-surface-container'
                    }`
                  }
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                  {item.label}
                </NavLink>
              </div>
            );
          })}
        </nav>

        {/* Account chip (Mentori-style) — click to sign out */}
        <div className="px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2">
          <button
            onClick={handleLogout}
            title="Click to sign out"
            className="group w-full flex items-center gap-3 p-2.5 rounded-2xl bg-primary text-on-primary hover:opacity-95 transition-all press-shrink"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-xl academic-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0 text-left leading-tight">
              <p className="text-sm font-bold truncate">{profile?.full_name || 'User'}</p>
              <p className="text-[0.7rem] text-on-primary/60 truncate">{roleLabel[role ?? ''] || 'Member'}</p>
            </div>
            <span className="material-symbols-outlined text-on-primary/50 group-hover:text-on-primary shrink-0 transition-colors" style={{ fontSize: '1.1rem' }}>logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
