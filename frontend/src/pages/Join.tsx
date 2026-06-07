import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import CinematicBg from '../components/CinematicBg';

/**
 * Mode B public landing (PRD §5.1). One-click Google OAuth — no email/password.
 * On success Google redirects to /auth/callback, which routes the user into
 * onboarding (first time) or their masterclass hub (returning).
 */
export default function Join() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    setIsLoading(true);
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    });
    if (oauthErr) {
      setError(oauthErr.message);
      setIsLoading(false);
    }
    // On success the browser is redirected to Google; no further code runs here.
  };

  return (
    <main className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden bg-[#04060f] text-white p-5 sm:p-8">
      <CinematicBg />

      <div className="relative z-10 w-full max-w-6xl grid lg:grid-cols-2 gap-8 lg:gap-12 items-center py-8">

        {/* ── Promo artwork ────────────────────────────────────────────────── */}
        <div className="relative order-1 fade-in-up">
          <div
            className="absolute -inset-6 rounded-[2rem] blur-3xl opacity-60"
            style={{ background: 'radial-gradient(circle at 50% 40%, rgba(124,92,255,0.45), rgba(10,92,255,0.2), transparent 70%)' }}
          />
          <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-white/[0.03]">
            <img
              src="/ai-masterclass-banner.png"
              alt="Zero to Hero — AI Sessions by Abdul Rafay"
              className="w-full h-auto block"
              loading="eager"
              onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
            />
          </div>
          {/* floating badges */}
          <span className="absolute -top-3 -left-3 px-3 py-1.5 rounded-full text-[0.7rem] font-extrabold uppercase tracking-wider text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#0a5cff,#7c5cff)' }}>
            Free for all
          </span>
          <span className="absolute -bottom-3 right-4 px-3 py-1.5 rounded-full text-[0.7rem] font-extrabold uppercase tracking-wider bg-white text-[#1a1145] shadow-lg">
            All ages welcome
          </span>
        </div>

        {/* ── Registration ─────────────────────────────────────────────────── */}
        <div className="order-2 max-w-md w-full mx-auto">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0a5cff,#7c5cff)' }}>
              <span className="material-symbols-outlined text-white" style={{ fontSize: '1.15rem' }}>rocket_launch</span>
            </div>
            <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50">EduConnect · AI Masterclass</p>
          </div>

          <h1 className="font-extrabold uppercase leading-[0.95] tracking-tight text-4xl sm:text-5xl">
            Zero to
            <br />
            <span style={{ background: 'linear-gradient(135deg,#4cc9f0,#7c5cff,#b5179e)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
              Hero
            </span>{' '}
            <span className="text-white/90">AI Sessions</span>
          </h1>

          <p className="text-white/55 text-sm sm:text-base mt-4 leading-relaxed">
            A 12-week hands-on journey into building with AI — for school students, college students,
            and curious minds of <span className="text-white font-semibold">every age</span>. It's never too
            early or too late to start.
          </p>

          <div className="mt-6 grid gap-3">
            {[
              { icon: 'school', text: 'Weekly live classes with a clear agenda' },
              { icon: 'quiz', text: 'Hands-on quizzes and real-world challenges' },
              { icon: 'workspace_premium', text: 'A completion certificate at the finish' },
            ].map((row) => (
              <div key={row.icon} className="flex items-center gap-3 text-sm text-white/70">
                <span className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#8b9dff]" style={{ fontSize: '1.05rem' }}>{row.icon}</span>
                </span>
                {row.text}
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-6 flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm font-medium">
              <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={isLoading}
            className="mt-7 w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-bold text-sm tracking-wide bg-white text-[#1a1145] shadow-xl hover:brightness-95 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                Redirecting…
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                Register free with Google
              </>
            )}
          </button>

          <p className="mt-4 text-center text-xs text-white/40">
            Already registered?{' '}
            <Link to="/login" className="font-bold text-[#8b9dff] hover:text-white transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
