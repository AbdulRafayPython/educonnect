import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

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
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.user) {
        setUser(data.user);

        // Fetch profile to determine role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (!profileError && profile) {
          setProfile(profile);
          navigate(profile.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-grow flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden min-h-screen bg-background">
      {/* Background Decorative Elements */}
      <div className="absolute -top-24 -right-24 w-96 h-96 academic-gradient opacity-[0.06] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-surface-tint opacity-[0.07] rounded-full blur-3xl pointer-events-none" />

      {/* Login Container */}
      <div className="w-full max-w-[420px] z-10">
        {/* Logo & Branding */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 academic-gradient flex items-center justify-center rounded-2xl mb-5 shadow-2xl">
            <span className="material-symbols-outlined text-white" style={{ fontSize: '2rem' }}>school</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">EduConnect</h1>
          <p className="text-secondary text-xs mt-1.5 uppercase tracking-[0.2em] opacity-70">Academic Atelier</p>
        </div>

        {/* Auth Card */}
        <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-outline-variant/30">
          <header className="mb-7">
            <h2 className="text-xl font-bold text-on-surface">Welcome Back</h2>
            <p className="text-on-surface-variant text-sm mt-1">Please enter your credentials to access your portal.</p>
          </header>

          {/* Error / Info Banners */}
          {error && (
            <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-medium">
              <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium">
              <span className="material-symbols-outlined text-base mt-0.5 shrink-0">check_circle</span>
              <span>{info}</span>
            </div>
          )}

          <form onSubmit={resetMode ? handleReset : handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="email">
                Email Address
              </label>
              <div className="relative ghost-border rounded-xl bg-surface-variant/40 transition-all duration-200 focus-within:bg-surface-variant/60">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: '1.1rem' }}>mail</span>
                <input
                  className="w-full pl-11 pr-4 py-3.5 bg-transparent border-none outline-none text-on-surface placeholder:text-outline/50 text-sm"
                  id="email"
                  name="email"
                  placeholder="you@institution.edu"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field — hidden in reset mode */}
            {!resetMode && (
              <div className="space-y-1.5">
                <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="password">
                  Password
                </label>
                <div className="relative ghost-border rounded-xl bg-surface-variant/40 transition-all duration-200 focus-within:bg-surface-variant/60">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: '1.1rem' }}>lock</span>
                  <input
                    className="w-full pl-11 pr-4 py-3.5 bg-transparent border-none outline-none text-on-surface placeholder:text-outline/50 text-sm"
                    id="password"
                    name="password"
                    placeholder="••••••••••••"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="pt-2">
              <button
                className="w-full academic-gradient text-white py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide shadow-lg hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                type="submit"
                id="login-btn"
                disabled={isLoading}
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
              className="text-xs font-semibold text-primary/70 hover:text-primary hover:underline underline-offset-4 transition-all"
            >
              {resetMode ? '← Back to Login' : 'Forgot Password?'}
            </button>
          </div>
        </div>

        <p className="text-center text-[0.65rem] uppercase tracking-widest text-secondary/40 mt-8">
          © 2025 EduConnect Academy. All rights reserved.
        </p>
      </div>
    </main>
  );
}
