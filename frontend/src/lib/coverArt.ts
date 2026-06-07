// Deterministic placeholder cover art for course cards that have no uploaded
// thumbnail. Mirrors the Mentori look (soft pastel scene + a category icon).
// The same seed always maps to the same cover, so a card's look is stable.

export interface CoverArt {
  gradient: string; // CSS background for the thumbnail area
  icon: string;     // Material Symbols glyph
  tint: string;     // icon / accent color
}

const COVERS: CoverArt[] = [
  { gradient: 'linear-gradient(135deg,#ede9fe 0%,#ddd6fe 100%)', icon: 'palette', tint: '#7c3aed' },
  { gradient: 'linear-gradient(135deg,#dbeafe 0%,#bfdbfe 100%)', icon: 'code', tint: '#2563eb' },
  { gradient: 'linear-gradient(135deg,#fce7f3 0%,#fbcfe8 100%)', icon: 'brush', tint: '#db2777' },
  { gradient: 'linear-gradient(135deg,#dcfce7 0%,#bbf7d0 100%)', icon: 'movie', tint: '#16a34a' },
  { gradient: 'linear-gradient(135deg,#fef3c7 0%,#fde68a 100%)', icon: 'lightbulb', tint: '#d97706' },
  { gradient: 'linear-gradient(135deg,#ccfbf1 0%,#99f6e4 100%)', icon: 'design_services', tint: '#0d9488' },
  { gradient: 'linear-gradient(135deg,#ffe4e6 0%,#fecdd3 100%)', icon: 'auto_stories', tint: '#e11d48' },
  { gradient: 'linear-gradient(135deg,#e0e7ff 0%,#c7d2fe 100%)', icon: 'school', tint: '#4f46e5' },
];

export function coverArtFor(seed: string): CoverArt {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COVERS[h % COVERS.length];
}
