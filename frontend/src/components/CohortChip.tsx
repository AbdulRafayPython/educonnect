import { cohortMeta, type AgeGroup } from '../lib/masterclass';

// A solid gradient cohort badge (color → deep) with a Material icon and white
// text. Reads cleanly on both light and dark surfaces — unlike the old pale
// tinted pill. Truncates gracefully in tight columns via `min-w-0` + `truncate`.
export default function CohortChip({
  ageGroup,
  className = '',
  size = 'md',
}: {
  ageGroup: AgeGroup | null;
  className?: string;
  size?: 'sm' | 'md';
}) {
  if (!ageGroup) return <span className="text-xs text-on-surface-variant">—</span>;
  const m = cohortMeta[ageGroup];
  const fs = size === 'sm' ? '0.6rem' : '0.65rem';
  const icon = size === 'sm' ? '0.8rem' : '0.9rem';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2 font-bold text-white shadow-sm align-middle ${className}`}
      style={{ background: `linear-gradient(135deg, ${m.color} 0%, ${m.deep} 100%)`, fontSize: fs }}
    >
      <span className="material-symbols-outlined shrink-0" style={{ fontSize: icon, fontVariationSettings: "'FILL' 1" }}>
        {m.icon}
      </span>
      <span className="truncate">{m.label}</span>
    </span>
  );
}
