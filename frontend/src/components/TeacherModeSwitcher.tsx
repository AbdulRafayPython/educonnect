import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Teacher mode switcher (PRD §1 / §16) — toggles the admin panel between the
 * 1:1 Private Track (Mode A) and the AI Masterclass Hub (Mode B). The active
 * mode is derived from the current path so it always matches the visible nav.
 * Rendered at the top of the teacher sidebar.
 */
export default function TeacherModeSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMasterclass = location.pathname.startsWith('/teacher/masterclass');

  const go = (to: string) => {
    onNavigate?.();
    navigate(to);
  };

  return (
    <div className="mx-3 mb-3 p-1 bg-surface-container rounded-xl flex gap-1" role="tablist" aria-label="Teaching mode">
      <button
        role="tab"
        aria-selected={!isMasterclass}
        onClick={() => isMasterclass && go('/teacher/dashboard')}
        className={`flex-1 px-2 py-2 text-[0.65rem] font-bold rounded-lg transition-all ${!isMasterclass ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
      >
        1:1 Track
      </button>
      <button
        role="tab"
        aria-selected={isMasterclass}
        onClick={() => !isMasterclass && go('/teacher/masterclass')}
        className={`flex-1 px-2 py-2 text-[0.65rem] font-bold rounded-lg transition-all ${isMasterclass ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
      >
        Masterclass
      </button>
    </div>
  );
}
