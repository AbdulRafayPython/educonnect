import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

/**
 * One-time teacher bootstrap (PRD §5.3 / FR-AUTH-T-01). Locked the moment any
 * teacher exists — the lock is enforced both here (teacher_exists) and at the
 * DB level (bootstrap_teacher re-checks before promoting). Requires the email
 * provider to allow sign-up for this single initial account.
 */
export default function Setup() {
  const navigate = useNavigate();
  const { setUser, setProfile } = useAppStore();
  const [locked, setLocked] = useState<boolean | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('teacher_exists').then(({ data, error: rpcErr }) => {
      // Fail safe: if the check errors, treat as locked rather than expose setup.
      setLocked(rpcErr ? true : Boolean(data));
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setIsLoading(true);
    try {
      const { data, error: signErr } = await supabase.auth.signUp({ email, password });
      if (signErr) { setError(signErr.message); return; }

      if (!data.session) {
        // Email confirmation is enabled — promotion happens after first sign-in
        // is not possible without a session, so guide the user explicitly.
        setInfo('Account created. Disable email confirmation for this initial account, or confirm your email and re-run setup while signed in.');
        return;
      }

      setUser(data.session.user);
      const { error: bootErr } = await supabase.rpc('bootstrap_teacher', { p_full_name: fullName });
      if (bootErr) { setError(bootErr.message); return; }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).single();
      if (profile) setProfile(profile);
      navigate('/teacher/dashboard', { replace: true });
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-9">
          <div className="w-16 h-16 academic-gradient flex items-center justify-center rounded-2xl mb-5 shadow-2xl">
            <span className="material-symbols-outlined text-white" style={{ fontSize: '2rem' }}>admin_panel_settings</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Teacher Setup</h1>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-outline-variant/30">
          {locked === null ? (
            <div className="py-8 flex flex-col items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              <p className="text-sm">Checking setup status…</p>
            </div>
          ) : locked ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-surface-variant/60 flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '1.5rem' }}>lock</span>
              </div>
              <h2 className="text-lg font-bold text-on-surface mb-1">Setup already complete</h2>
              <p className="text-sm text-on-surface-variant mb-6">The teacher account exists. Use the login page to sign in.</p>
              <Link to="/login" className="inline-flex items-center gap-2 academic-gradient text-white py-2.5 px-6 rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-all active:scale-[0.98]">
                Go to login
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>
          ) : (
            <>
              <header className="mb-7">
                <h2 className="text-xl font-bold text-on-surface">Create the teacher account</h2>
                <p className="text-on-surface-variant text-sm mt-1">This is a one-time step and locks afterwards.</p>
              </header>

              {error && (
                <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-medium">
                  <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
                  <span>{error}</span>
                </div>
              )}
              {info && (
                <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium">
                  <span className="material-symbols-outlined text-base mt-0.5 shrink-0">info</span>
                  <span>{info}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="name">Full name</label>
                  <input id="name" className="w-full px-4 py-3.5 rounded-xl bg-surface-variant/40 border border-outline-variant/40 outline-none text-on-surface text-sm focus:border-primary transition-all" value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={isLoading} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="email">Email</label>
                  <input id="email" type="email" className="w-full px-4 py-3.5 rounded-xl bg-surface-variant/40 border border-outline-variant/40 outline-none text-on-surface text-sm focus:border-primary transition-all" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="password">Password</label>
                  <input id="password" type="password" className="w-full px-4 py-3.5 rounded-xl bg-surface-variant/40 border border-outline-variant/40 outline-none text-on-surface text-sm focus:border-primary transition-all" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} disabled={isLoading} />
                </div>
                <button type="submit" disabled={isLoading} className="w-full academic-gradient text-white py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide shadow-lg hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  {isLoading ? (<><span className="material-symbols-outlined animate-spin text-base">progress_activity</span>Creating…</>) : (<>Create teacher account<span className="material-symbols-outlined text-base">arrow_forward</span></>)}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
