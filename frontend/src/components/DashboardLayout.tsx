import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

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
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar navItems={navItems} />
      <div className="flex-1 flex flex-col ml-60">
        <TopBar title={title} />
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
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
    </div>
  );
}
