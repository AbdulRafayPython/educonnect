// Theme helper. The initial class is applied pre-paint by the inline script in
// index.html (no FOUC); this module handles user-initiated flips + persistence.

export type Theme = 'light' | 'dark';

const KEY = 'educonnect:theme';

export function getTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(theme: Theme): void {
  const root = document.documentElement;
  // Enable the color transition only for deliberate flips, then remove it so
  // route changes / first paint don't smear.
  root.classList.add('theme-anim');
  root.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // ignore private-mode / quota failures
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0a0c' : '#f4f4f6');
  window.setTimeout(() => root.classList.remove('theme-anim'), 320);
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
