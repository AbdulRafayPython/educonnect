import { Suspense, lazy, Component, type ReactNode } from 'react';

// three/fiber/drei live in their own lazy chunk so the login renders instantly.
const GlassHero = lazy(() => import('./GlassHero'));

// CSS iridescent blob — shown while the 3D loads, and as the permanent fallback
// for reduced-motion users and devices without WebGL.
function CssBlob() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="hero-blob" />
    </div>
  );
}

class WebGLBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function HeroStage() {
  if (prefersReduced) return <CssBlob />;
  // On desktop the canvas is full-bleed, so push the object left of center to
  // keep the form side clear; on mobile it sits centered in the top band.
  const desktop = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches;
  return (
    <WebGLBoundary fallback={<CssBlob />}>
      <Suspense fallback={<CssBlob />}>
        <GlassHero offsetX={desktop ? -2.4 : 0} />
      </Suspense>
    </WebGLBoundary>
  );
}
