// Shared dark "space nebula" backdrop for the pre-auth pages: deep blue→black
// gradient, colored blooms, and a faint twinkling starfield (with a few red
// specks, per the reference art). Purely decorative.

const stars = Array.from({ length: 50 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * n) * 10000;
    return x - Math.floor(x);
  };
  return {
    top: `${r(12.9898) * 100}%`,
    left: `${r(78.233) * 100}%`,
    size: r(43.21) < 0.14 ? 2.5 : 1.2,
    red: r(91.7) < 0.16,
    delay: `${r(7.1) * 4}s`,
  };
});

export default function CinematicBg() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(125% 105% at 12% 8%, #0b2e72 0%, #061232 34%, #04060f 68%, #020308 100%)' }}
      />
      {/* electric-blue glow (top-left) */}
      <div
        className="absolute -top-40 -left-28 w-[38rem] h-[38rem] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(10,92,255,0.38), transparent 70%)' }}
      />
      {/* warm maroon haze (center-left) */}
      <div
        className="absolute top-1/3 left-1/4 w-[30rem] h-[30rem] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(125,22,42,0.20), transparent 70%)' }}
      />
      {/* violet bloom (bottom-right) */}
      <div
        className="absolute -bottom-24 -right-24 w-[34rem] h-[34rem] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(124,92,255,0.22), transparent 70%)' }}
      />
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full twinkle"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            background: s.red ? '#ff5a6e' : '#ffffff',
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  );
}
