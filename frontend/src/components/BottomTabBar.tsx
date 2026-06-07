import { NavLink } from 'react-router-dom';

interface NavItem {
  icon: string;
  label: string;
  to: string;
}

/**
 * Mode B mobile bottom tab bar (PRD §8.5). Shown only below `lg`; on desktop the
 * left sidebar is used instead. Max 4 tabs. Active tab uses the accent/primary
 * color. Honors the iOS home-indicator safe area.
 */
export default function BottomTabBar({ navItems }: { navItems: NavItem[] }) {
  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/20 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch justify-around">
        {navItems.slice(0, 4).map((item) => {
          // Exact match for top-level hubs (e.g. /masterclass), prefix match for
          // nested routes so detail pages keep their tab highlighted.
          const exact = item.to.split('/').filter(Boolean).length <= 1;
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={exact}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 py-2.5 text-[0.6rem] font-bold tracking-wide transition-colors ${
                    isActive ? 'text-primary' : 'text-on-surface-variant'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: '1.4rem', fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
