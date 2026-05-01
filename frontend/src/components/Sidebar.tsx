import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

interface NavItem {
  icon: string;
  label: string;
  to: string;
}

interface SidebarProps {
  navItems: NavItem[];
}

export default function Sidebar({ navItems }: SidebarProps) {
  const navigate = useNavigate();
  const { setUser, setProfile } = useAppStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 flex flex-col bg-surface-container-low z-50 border-r border-outline-variant/20">
      <div className="px-6 py-7">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 academic-gradient rounded-lg flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white" style={{ fontSize: '1rem' }}>school</span>
          </div>
          <span className="text-xl font-bold text-primary tracking-tight">EduConnect</span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.endsWith('/dashboard')}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`
            }
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-outline-variant/20">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full text-sm font-medium text-on-surface-variant hover:text-error hover:bg-error-container/30 rounded-xl transition-all duration-150"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>logout</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
