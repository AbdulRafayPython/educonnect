import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getTheme, toggleTheme, type Theme } from '../lib/theme';

export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const dark = theme === 'dark';

  return (
    <button
      onClick={() => setThemeState(toggleTheme())}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface-container transition-colors overflow-hidden"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 14, opacity: 0, rotate: -90, scale: 0.4 }}
          animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
          exit={{ y: -14, opacity: 0, rotate: 90, scale: 0.4 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="material-symbols-outlined text-on-surface-variant"
          style={{ fontSize: '1.25rem' }}
        >
          {dark ? 'dark_mode' : 'light_mode'}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
