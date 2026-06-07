import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import TeacherModeSwitcher from './TeacherModeSwitcher';

interface NavItem {
  icon: string;
  label: string;
  to: string;
}

interface SidebarProps {
  navItems: NavItem[];
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ navItems, open = false, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const { setUser, setProfile, role } = useAppStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    onClose?.();
    navigate('/login');
  };

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
        className={`fixed left-0 top-0 h-[100dvh] w-64 sm:w-60 flex flex-col bg-surface-container-low z-50 border-r border-outline-variant/20 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 sm:px-6 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 academic-gradient rounded-lg flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white" style={{ fontSize: '1rem' }}>school</span>
            </div>
            <span className="text-xl font-bold text-primary tracking-tight truncate">EduConnect</span>
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

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto overscroll-contain">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.endsWith('/dashboard') || item.to === '/teacher/masterclass'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface active:bg-surface-container'
                }`
              }
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] border-t border-outline-variant/20">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-3 lg:py-2.5 w-full text-sm font-medium text-on-surface-variant hover:text-error hover:bg-error-container/30 rounded-xl transition-all duration-150"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>logout</span>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
