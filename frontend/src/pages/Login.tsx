import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { roleHome } from '../lib/nav';
import CinematicBg from '../components/CinematicBg';
import HeroVideo from '../components/HeroVideo';

export default function Login() {
  const navigate = useNavigate();
  const { setUser, setProfile } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email) { setError('Enter your email first.'); return; }
    setIsLoading(true);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login',
    });
    setIsLoading(false);
    if (resetErr) setError(resetErr.message);
    else setInfo('Password reset email sent. Check your inbox.');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.user) {
        setUser(data.user);
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (!profileError && profile) {
          setProfile(profile);
          navigate(roleHome(profile.role));
        }
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputWrap =
    'relative rounded-xl bg-white/[0.04] border border-white/10 transition-all duration-200 focus-within:border-[#7c5cff] focus-within:bg-white/[0.07]';

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#04060f] text-white">

      {/* Full-bleed nebula spanning the whole page (darkens toward the right). */}
      <CinematicBg />

      {/* Hero video — full-bleed, pushed left (object-position), and the right
          third fades to solid dark so the scene never reaches the form. */}
      <div className="absolute inset-0 pointer-events-none">
        <HeroVideo />
        {/* desktop: fade the right side to dark, fully opaque before the form */}
        <div className="hidden lg:block absolute inset-0" style={{ background: 'linear-gradient(90deg, transparent 26%, rgba(4,6,15,0.55) 44%, #04060f 60%)' }} />
        {/* mobile: fade out to the bottom */}
        <div className="lg:hidden absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 46%, #04060f 92%)' }} />
      </div>

      {/* Soft glow pooled behind the form to lift it off the scene. */}
      <div className="hidden lg:block absolute top-1/2 right-0 w-[42%] h-[80%] -translate-y-1/2 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 70% 50%, rgba(124,92,255,0.10), transparent 70%)' }} />

      <div className="relative z-10 grid lg:grid-cols-2 min-h-[100dvh]">

        {/* ── Showcase copy (over the 3D) ─────────────────────────────────── */}
        <section className="relative flex flex-col justify-start lg:justify-between gap-8 lg:gap-10 p-8 lg:p-12 pointer-events-none min-h-[38vh] lg:min-h-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#0a5cff,#7c5cff)' }}>
              <span className="material-symbols-outlined text-white" style={{ fontSize: '1.15rem' }}>school</span>
            </div>
            <div className="leading-none">
              <p className="font-extrabold tracking-tight text-lg">EduConnect</p>
              <p className="text-[0.6rem] uppercase tracking-[0.3em] text-white/50 mt-1">AI Atelier</p>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="font-extrabold uppercase leading-[0.92] tracking-tight text-[2.75rem] sm:text-6xl drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
              Master AI.
              <br />
              <span style={{ background: 'linear-gradient(135deg,#4cc9f0,#7c5cff,#b5179e)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                Shape
              </span>{' '}
              tomorrow<span className="text-[#7c5cff]">.</span>
            </h1>
            <p className="text-white/55 text-sm sm:text-base mt-4 leading-relaxed max-w-sm">
              Step into a learning experience built for the AI era. Sign in to enter your portal.
            </p>
          </div>
        </section>

        {/* ── Auth ────────────────────────────────────────────────────────── */}
        <section className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px] fade-in-up">
          <header className="mb-7">
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-white/50 text-sm mt-1.5">Enter your credentials to access your portal.</p>
          </header>

          {error && (
            <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm font-medium">
              <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-medium">
              <span className="material-symbols-outlined text-base mt-0.5 shrink-0">check_circle</span>
              <span>{info}</span>
            </div>
          )}

          <form onSubmit={resetMode ? handleReset : handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-white/45" htmlFor="email">Email address</label>
              <div className={inputWrap}>
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30" style={{ fontSize: '1.1rem' }}>mail</span>
                <input
                  className="w-full pl-11 pr-4 py-3.5 bg-transparent border-none outline-none text-white placeholder:text-white/25 text-sm"
                  id="email" name="email" placeholder="you@institution.edu" type="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isLoading}
                />
              </div>
            </div>

            {!resetMode && (
              <div className="space-y-1.5">
                <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-white/45" htmlFor="password">Password</label>
                <div className={inputWrap}>
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30" style={{ fontSize: '1.1rem' }}>lock</span>
                  <input
                    className="w-full pl-11 pr-4 py-3.5 bg-transparent border-none outline-none text-white placeholder:text-white/25 text-sm"
                    id="password" name="password" placeholder="••••••••••••" type="password"
                    value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading}
                  />
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                className="w-full text-white py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-[#0a5cff]/20 hover:brightness-110 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#0a5cff,#7c5cff)' }}
                type="submit" disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                    {resetMode ? 'Sending…' : 'Signing in…'}
                  </>
                ) : (
                  <>
                    {resetMode ? 'Send reset email' : 'Login'}
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => { setResetMode(!resetMode); setError(null); setInfo(null); }}
              className="text-xs font-semibold text-white/50 hover:text-white hover:underline underline-offset-4 transition-all"
            >
              {resetMode ? '← Back to login' : 'Forgot password?'}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-sm text-white/45">
              New to the AI Masterclass?{' '}
              <Link to="/join" className="font-bold text-[#8b9dff] hover:text-white transition-colors">Register free →</Link>
            </p>
          </div>

          <p className="text-center text-[0.65rem] uppercase tracking-widest text-white/25 mt-8">
            © 2026 EduConnect · All rights reserved
          </p>
        </div>
        </section>
      </div>
    </main>
  );
}
