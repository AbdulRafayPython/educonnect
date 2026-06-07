import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomTabBar from './BottomTabBar';
import { useAppStore } from '../store/useAppStore';
import { teacherNavForPath } from '../lib/nav';

interface NavItem {
  icon: string;
  label: string;
  to: string;
}

interface DashboardLayoutProps {
  title: string;
  navItems: NavItem[];
  children: ReactNode;
}

export default function DashboardLayout({ title, navItems, children }: DashboardLayoutProps) {
  const location = useLocation();
  const { role } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Mode B students get a mobile bottom tab bar (PRD §8.5) instead of the
  // hamburger drawer. Desktop still uses the left sidebar for all roles.
  const useBottomTabs = role === 'student_group';

  // For teachers, the visible nav follows the current mode (1:1 vs Masterclass)
  // derived from the path, so individual pages don't pass mode-specific navs.
  const effectiveNav = role === 'teacher' ? teacherNavForPath(location.pathname) : navItems;

  return (
    <div className="min-h-[100dvh] bg-background flex">
      <Sidebar navItems={effectiveNav} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-60">
        <TopBar title={title} onMenuClick={useBottomTabs ? undefined : () => setSidebarOpen(true)} />
        <main className={`flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden ${useBottomTabs ? 'pb-24 lg:pb-8' : ''}`}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>
      {useBottomTabs && <BottomTabBar navItems={effectiveNav} />}
    </div>
  );
}
