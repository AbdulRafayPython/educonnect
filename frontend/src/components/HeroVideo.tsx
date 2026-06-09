// Lightweight looping hero video — replaces the three.js GlassHero, which lagged
// on mobile. Muted + playsInline + autoPlay so it auto-starts on iOS/Android.
// Reduced-motion users get the CSS iridescent blob instead of a playing video.

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function CssBlob() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="hero-blob" />
    </div>
  );
}

export default function HeroVideo() {
  if (prefersReduced) return <CssBlob />;
  return (
    <video
      // muted must be set as a property too for reliable iOS autoplay
      ref={(el) => { if (el) el.muted = true; }}
      className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none lg:-translate-x-[20%]"
      src="/ai-handshake.mp4"
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      controls={false}
    />
  );
}
