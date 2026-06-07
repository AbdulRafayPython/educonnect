import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

type AgeGroup = 'little_ones' | 'juniors' | 'advanced';

const ageOptions: { value: AgeGroup; title: string; sub: string; icon: string; ring: string }[] = [
  { value: 'little_ones', title: "I'm 5–10 years old", sub: 'Little Explorers — play-based, guided', icon: 'child_care', ring: 'data-[on=true]:border-[#A78BFA] data-[on=true]:bg-[#A78BFA]/10' },
  { value: 'juniors', title: "I'm 11–15", sub: 'Junior Builders — build real outputs', icon: 'rocket_launch', ring: 'data-[on=true]:border-[#34D399] data-[on=true]:bg-[#34D399]/10' },
  { value: 'advanced', title: "I'm 16 or older / university", sub: 'AI Architects — full agent building', icon: 'smart_toy', ring: 'data-[on=true]:border-[#F97316] data-[on=true]:bg-[#F97316]/10' },
];

/**
 * Mode B onboarding (PRD §5.1). Two steps: confirm name → pick age group.
 * Submitting calls the complete_onboarding RPC, which find-or-creates the
 * active cohort for the age group, enrols the student, and flips
 * onboarding_complete. We then refresh the cached profile and enter the hub.
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, setProfile } = useAppStore();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState<string>(profile?.full_name || '');
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarUrl = profile?.avatar_url as string | undefined;
  const initials = fullName ? fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '🙂';

  const submit = async () => {
    if (!ageGroup) { setError('Please choose your age group.'); return; }
    setError(null);
    setIsLoading(true);
    const { error: rpcErr } = await supabase.rpc('complete_onboarding', {
      p_age_group: ageGroup,
      p_full_name: fullName,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      setIsLoading(false);
      return;
    }
    // Refresh the profile so role/cohort/onboarding_complete are current.
    if (user) {
      const { data: fresh } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (fresh) setProfile(fresh);
    }
    navigate('/masterclass', { replace: true });
  };

  return (
    <main className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[460px]">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2].map((n) => (
            <div key={n} className={`h-1.5 rounded-full transition-all ${n === step ? 'w-8 bg-primary' : n < step ? 'w-8 bg-primary/40' : 'w-4 bg-outline-variant/40'}`} />
          ))}
        </div>

        <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-outline-variant/30">
          {error && (
            <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-medium">
              <span className="material-symbols-outlined text-base mt-0.5 shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {step === 1 ? (
            <>
              <header className="mb-7 text-center">
                <h2 className="text-xl font-bold text-on-surface">Welcome! Let's set up your profile</h2>
                <p className="text-on-surface-variant text-sm mt-1.5">Confirm how your name should appear.</p>
              </header>

              <div className="flex justify-center mb-6">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover ring-2 ring-outline-variant/40" />
                ) : (
                  <div className="w-20 h-20 rounded-full academic-gradient flex items-center justify-center text-white text-2xl font-bold">{initials}</div>
                )}
              </div>

              <div className="space-y-1.5 mb-7">
                <label className="block text-[0.6875rem] font-bold uppercase tracking-wider text-on-surface-variant" htmlFor="name">Display name</label>
                <input
                  id="name"
                  className="w-full px-4 py-3.5 rounded-xl bg-surface-variant/40 border border-outline-variant/40 outline-none text-on-surface text-sm focus:border-primary focus:bg-surface-variant/60 transition-all"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <button
                onClick={() => { if (!fullName.trim()) { setError('Please enter your name.'); return; } setError(null); setStep(2); }}
                className="w-full academic-gradient text-white py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide shadow-lg hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                Continue
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </>
          ) : (
            <>
              <header className="mb-7 text-center">
                <h2 className="text-xl font-bold text-on-surface">Which group are you in?</h2>
                <p className="text-on-surface-variant text-sm mt-1.5">This places you in the right cohort.</p>
              </header>

              <div className="space-y-3 mb-7">
                {ageOptions.map((opt) => (
                  <button
                    key={opt.value}
                    data-on={ageGroup === opt.value}
                    onClick={() => { setAgeGroup(opt.value); setError(null); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all border-outline-variant/40 hover:border-outline-variant ${opt.ring}`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-surface-variant/60 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '1.4rem' }}>{opt.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface">{opt.title}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">{opt.sub}</p>
                    </div>
                    {ageGroup === opt.value && (
                      <span className="material-symbols-outlined text-primary ml-auto" style={{ fontSize: '1.3rem' }}>check_circle</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setError(null); setStep(1); }}
                  disabled={isLoading}
                  className="px-5 py-3.5 rounded-xl font-bold text-sm border border-outline-variant/60 text-on-surface hover:bg-surface-variant/40 transition-all disabled:opacity-60"
                >
                  Back
                </button>
                <button
                  onClick={submit}
                  disabled={isLoading}
                  className="flex-1 academic-gradient text-white py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide shadow-lg hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                      Setting up…
                    </>
                  ) : (
                    <>
                      Enter the masterclass
                      <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
