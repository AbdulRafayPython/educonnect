import { useState } from 'react';
import { supabase } from '../lib/supabase';

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
    <main className="flex-grow flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden min-h-[100dvh] bg-background">
      <div className="absolute -top-24 -right-24 w-96 h-96 academic-gradient opacity-[0.06] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-surface-tint opacity-[0.07] rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[440px] z-10">
        <div className="flex flex-col items-center mb-9">
          <div className="w-16 h-16 academic-gradient flex items-center justify-center rounded-2xl mb-5 shadow-2xl">
            <span className="material-symbols-outlined text-white" style={{ fontSize: '2rem' }}>rocket_launch</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary text-center">Zero to Hero AI Sessions</h1>
          <p className="text-secondary text-xs mt-2 uppercase tracking-[0.2em] opacity-70">EduConnect · AI Masterclass</p>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-outline-variant/30">
          <header className="mb-7 text-center">
            <h2 className="text-xl font-bold text-on-surface">Join the program</h2>
            <p className="text-on-surface-variant text-sm mt-2 leading-relaxed">
              A 12-week hands-on journey into building with AI — for every age group.
              Sign in with Google to claim your spot.
            </p>
          </header>

          {error && (
            <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-medium">
              <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide border border-outline-variant/60 bg-white text-on-surface shadow-sm hover:bg-surface-variant/40 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
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
                Continue with Google
              </>
            )}
          </button>

          <div className="mt-6 grid gap-3">
            {[
              { icon: 'school', text: 'Weekly live classes with a clear agenda' },
              { icon: 'quiz', text: 'Hands-on quizzes and challenges' },
              { icon: 'workspace_premium', text: 'A completion certificate at the finish' },
            ].map((row) => (
              <div key={row.icon} className="flex items-center gap-3 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-primary/70" style={{ fontSize: '1.1rem' }}>{row.icon}</span>
                {row.text}
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[0.65rem] uppercase tracking-widest text-secondary/40 mt-8">
          Private program · Invite shared by your teacher
        </p>
      </div>
    </main>
  );
}
