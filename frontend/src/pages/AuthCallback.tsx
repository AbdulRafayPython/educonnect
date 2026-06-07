import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { roleHome } from '../lib/nav';

/**
 * Supabase OAuth redirect handler (PRD §16 `/auth/callback`).
 * supabase-js auto-exchanges the code/hash in the URL for a session on load;
 * we poll briefly for that session, then route by role + onboarding state.
 * The student_group profile row is created synchronously by the
 * handle_new_user() auth trigger, so it exists by the time the session does.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser, setProfile } = useAppStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Surface an OAuth provider error returned in the URL (e.g. access denied).
    const params = new URLSearchParams(window.location.hash.replace(/^#/, '') || window.location.search);
    const oauthError = params.get('error_description') || params.get('error');
    if (oauthError) {
      setError(decodeURIComponent(oauthError));
      return;
    }

    let cancelled = false;
    const run = async () => {
      // Poll up to ~3s for the session to materialise from the URL exchange.
      let session = null;
      for (let i = 0; i < 20 && !session; i++) {
        const { data } = await supabase.auth.getSession();
        session = data.session;
        if (!session) await new Promise((r) => setTimeout(r, 150));
      }
      if (cancelled) return;
      if (!session) {
        setError('Sign-in did not complete. Please try again.');
        return;
      }

      setUser(session.user);
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (cancelled) return;

      if (!profile) {
        // Trigger normally creates it; fall through to onboarding which re-checks.
        navigate('/onboarding', { replace: true });
        return;
      }
      setProfile(profile);
      if (profile.role !== 'student_group') {
        navigate(roleHome(profile.role), { replace: true });
      } else if (!profile.onboarding_complete) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/masterclass', { replace: true });
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
      {error ? (
        <>
          <div className="w-12 h-12 rounded-2xl bg-error-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-error-container" style={{ fontSize: '1.5rem' }}>error</span>
          </div>
          <p className="text-sm font-medium text-on-surface max-w-sm">{error}</p>
          <button
            onClick={() => navigate('/join', { replace: true })}
            className="academic-gradient text-white py-2.5 px-6 rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-all active:scale-[0.98]"
          >
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <div className="w-12 h-12 academic-gradient rounded-2xl flex items-center justify-center shadow-xl">
            <span className="material-symbols-outlined text-white animate-spin" style={{ fontSize: '1.5rem' }}>progress_activity</span>
          </div>
          <p className="text-sm font-bold text-primary/60 uppercase tracking-widest">Signing you in…</p>
        </>
      )}
    </main>
  );
}
