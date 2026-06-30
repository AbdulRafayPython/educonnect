import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../lib/useToast';
import { masterclassNav } from '../lib/nav';
import {
  ARENA_INGREDIENTS, ARENA_ROUNDS, arenaRoundMeta, arenaVerdict,
  claimArenaTopic, fetchArenaState, gradeArenaPrompt,
  type ArenaBreakdown, type ArenaClaim, type ArenaRound, type ArenaRoundState, type ArenaState,
} from '../lib/masterclass';

type View = 'map' | 'play' | 'reveal';

interface ActivePlay {
  round: ArenaRound;
  attemptId: string;
  scenario: string;
  audience: string | null;
}
interface RevealData {
  round: ArenaRound;
  scenario: string;
  prompt: string;
  score: number;
  breakdown: ArenaBreakdown;
  feedback: string | null;
  strengths: string | null;
  fixes: string | null;
  celebrate: boolean;
}

// ── Small animated primitives ────────────────────────────────────────────────

function CountUp({ value, duration = 900, className }: { value: number; duration?: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setN(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className={className}>{Math.round(n)}</span>;
}

const CONFETTI_COLORS = ['#22C55E', '#F59E0B', '#EF4444', '#22D3EE', '#A78BFA', '#FACC15'];
interface ConfettiPiece { id: number; x: number; rot: number; delay: number; dur: number; color: string; size: number }
// Randomised outside render (Math.random is impure) — generated in an effect on mount.
function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: 54 }, (_, i) => ({
    id: i,
    x: (Math.random() * 2 - 1) * 240,
    rot: Math.random() * 900 - 450,
    delay: Math.random() * 0.25,
    dur: 1.5 + Math.random() * 1.3,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 6 + Math.random() * 9,
  }));
}
function Confetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  useEffect(() => {
    // Defer one frame so the randomness lives outside render and outside the
    // synchronous effect body (keeps the react-hooks purity/set-state rules happy).
    const id = requestAnimationFrame(() => setPieces(makeConfetti()));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-4 bottom-0 overflow-hidden flex justify-center z-20">
      {pieces.map((p) => (
        <motion.div key={p.id}
          initial={{ y: -30, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: 560, x: p.x, opacity: 0, rotate: p.rot }}
          transition={{ duration: p.dur, delay: p.delay, ease: 'easeOut' }}
          className="absolute top-0"
          style={{ width: p.size, height: p.size * 0.5, background: p.color, borderRadius: 2 }} />
      ))}
    </div>
  );
}

function Stars({ score, size = 22 }: { score: number; size?: number }) {
  const full = Math.floor(score / 2);
  const half = score % 2 === 1;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const icon = i < full ? 'star' : i === full && half ? 'star_half' : 'star';
        const filled = i < full || (i === full && half);
        return (
          <motion.span key={i} className="material-symbols-outlined text-amber-400"
            initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.5 + i * 0.08, type: 'spring', stiffness: 300, damping: 12 }}
            style={{ fontSize: size, fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0", opacity: filled ? 1 : 0.3 }}>
            {icon}
          </motion.span>
        );
      })}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MasterclassArena() {
  const toast = useToast();
  const [view, setView] = useState<View>('map');
  const [state, setState] = useState<ArenaState | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [active, setActive] = useState<ActivePlay | null>(null);
  const [prompt, setPrompt] = useState('');
  const [busyRound, setBusyRound] = useState<ArenaRound | null>(null);
  const [grading, setGrading] = useState(false);
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const playRef = useRef<HTMLTextAreaElement | null>(null);

  const refresh = async () => {
    try {
      setState(await fetchArenaState());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load the quest.');
    }
  };

  useEffect(() => {
    (async () => { await refresh(); setLoading(false); })();
  }, []);

  const openRound = async (r: ArenaRoundState) => {
    if (!r.unlocked) {
      toast.error('Locked', 'Finish the previous round first.');
      return;
    }
    if (r.status === 'graded' && r.breakdown) {
      setReveal({
        round: r.round, scenario: r.scenario ?? '', prompt: r.prompt_text ?? '',
        score: r.score ?? 0, breakdown: r.breakdown, feedback: r.feedback,
        strengths: r.strengths, fixes: r.fixes, celebrate: false,
      });
      setView('reveal');
      return;
    }
    // Claim or resume the scenario.
    setBusyRound(r.round);
    try {
      const claim: ArenaClaim = await claimArenaTopic(r.round);
      if (claim.status === 'graded' && claim.breakdown) {
        setReveal({
          round: claim.round, scenario: claim.scenario, prompt: claim.prompt_text ?? '',
          score: claim.score ?? 0, breakdown: claim.breakdown, feedback: claim.feedback,
          strengths: claim.strengths, fixes: claim.fixes, celebrate: false,
        });
        setView('reveal');
      } else {
        setActive({ round: claim.round, attemptId: claim.attempt_id, scenario: claim.scenario, audience: claim.audience });
        setPrompt(claim.prompt_text ?? '');
        setView('play');
        setTimeout(() => playRef.current?.focus(), 250);
      }
    } catch (e) {
      toast.error('Could not start', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusyRound(null);
    }
  };

  const submit = async () => {
    if (!active) return;
    if (prompt.trim().length < 8) {
      toast.error('Add a bit more', 'Write a real prompt using the 5 ingredients before scoring.');
      return;
    }
    setGrading(true);
    try {
      const res = await gradeArenaPrompt(active.attemptId, prompt.trim());
      setReveal({
        round: active.round, scenario: active.scenario, prompt: prompt.trim(),
        score: res.score, breakdown: res.breakdown, feedback: res.feedback,
        strengths: res.strengths, fixes: res.fixes, celebrate: res.score >= 8,
      });
      await refresh();
      setView('reveal');
    } catch (e) {
      toast.error('Scoring failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setGrading(false);
    }
  };

  const backToMap = async () => { await refresh(); setActive(null); setView('map'); };

  const nextAfterReveal = async () => {
    await refresh();
    const fresh = await fetchArenaState().catch(() => null);
    const rounds = fresh?.rounds ?? state?.rounds ?? [];
    const idx = ARENA_ROUNDS.findIndex((x) => x.key === reveal?.round);
    const next = rounds.find((rr) => rr.round === ARENA_ROUNDS[idx + 1]?.key);
    setReveal(null);
    if (next && next.unlocked && next.status !== 'graded') {
      openRound(next);
    } else {
      setActive(null);
      setView('map');
    }
  };

  return (
    <DashboardLayout title="Prompt Quest" navItems={masterclassNav}>
      <div className="max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {loading ? (
            <div key="l" className="h-72 rounded-3xl bg-surface-container/40 animate-pulse" />
          ) : err ? (
            <p key="e" className="text-sm text-error">{err}</p>
          ) : view === 'map' ? (
            <MapView key="map" state={state} busyRound={busyRound} onOpen={openRound} />
          ) : view === 'play' && active ? (
            <PlayView key="play"
              active={active} prompt={prompt} setPrompt={setPrompt}
              grading={grading} onSubmit={submit} onBack={backToMap} textareaRef={playRef} />
          ) : view === 'reveal' && reveal ? (
            <RevealView key="reveal" reveal={reveal} onBack={backToMap} onNext={nextAfterReveal} />
          ) : null}
        </AnimatePresence>
      </div>
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </DashboardLayout>
  );
}

// ── Map ──────────────────────────────────────────────────────────────────────

function MapView({ state, busyRound, onOpen }: { state: ArenaState | null; busyRound: ArenaRound | null; onOpen: (r: ArenaRoundState) => void }) {
  const rounds = state?.rounds ?? [];
  const total = state?.total_score ?? 0;
  const max = state?.max_score ?? 30;
  const gradedCount = rounds.filter((r) => r.status === 'graded').length;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      {/* Hero */}
      <div className="academic-gradient rounded-3xl p-6 sm:p-8 relative overflow-hidden text-white">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 0, transparent 45%), radial-gradient(circle at 85% 70%, white 0, transparent 40%)' }} />
        <div className="relative">
          <div className="flex items-center gap-2 text-white/70 text-[0.65rem] font-bold uppercase tracking-[0.2em]">
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>map</span>Prompt Quest
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">Talk to AI like a pro</h2>
          <p className="text-white/80 text-sm mt-1.5 max-w-lg">
            Three rounds. A fresh scenario each time. Write the best prompt you can using the 5-ingredient recipe — an AI judge scores it out of 10, and your points climb the leaderboard.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="bg-white/15 backdrop-blur rounded-xl px-3.5 py-2">
              <p className="text-[0.55rem] font-bold uppercase tracking-widest text-white/60">Your score</p>
              <p className="font-extrabold text-lg leading-none mt-0.5">{total} <span className="text-white/60 text-sm">/ {max}</span></p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-xl px-3.5 py-2">
              <p className="text-[0.55rem] font-bold uppercase tracking-widest text-white/60">Rounds done</p>
              <p className="font-extrabold text-lg leading-none mt-0.5">{gradedCount} <span className="text-white/60 text-sm">/ 3</span></p>
            </div>
            <Link to="/masterclass/leaderboard" className="ml-auto inline-flex items-center gap-1.5 bg-white text-[#6d28d9] text-sm font-bold rounded-xl px-3.5 py-2 hover:opacity-90">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>leaderboard</span>Leaderboard
            </Link>
          </div>
        </div>
      </div>

      {/* The recipe reference */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-4 sm:p-5">
        <p className="text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Your 5-ingredient recipe</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {ARENA_INGREDIENTS.map((ing) => (
            <div key={ing.key} className="rounded-xl bg-surface-container/50 p-3 text-center">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: '1.4rem' }}>{ing.icon}</span>
              <p className="font-extrabold text-on-surface text-xs mt-1 tracking-wide">{ing.label}</p>
              <p className="text-[0.65rem] text-on-surface-variant leading-tight mt-0.5">{ing.blurb}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quest path */}
      <div className="relative">
        <div className="hidden sm:block absolute top-[46px] left-[18%] right-[18%] h-1.5 rounded-full bg-outline-variant/25" />
        <div className="grid sm:grid-cols-3 gap-4 relative">
          {ARENA_ROUNDS.map((meta, i) => {
            const r = rounds.find((x) => x.round === meta.key);
            return <QuestNode key={meta.key} index={i} meta={meta} r={r} busy={busyRound === meta.key} onOpen={onOpen} />;
          })}
        </div>
      </div>

      {!state?.has_cohort && (
        <p className="text-sm text-amber-700 bg-amber-100 rounded-xl px-4 py-3">
          You're not in a cohort yet — finish onboarding to start the quest.
        </p>
      )}
    </motion.div>
  );
}

function QuestNode({ index, meta, r, busy, onOpen }: {
  index: number;
  meta: typeof ARENA_ROUNDS[number];
  r?: ArenaRoundState;
  busy: boolean;
  onOpen: (r: ArenaRoundState) => void;
}) {
  const unlocked = r?.unlocked ?? (meta.key === 'easy');
  const graded = r?.status === 'graded';
  const inProgress = r?.status === 'assigned' || r?.status === 'submitted';
  const locked = !unlocked;

  const action = locked ? 'Locked' : graded ? 'View result' : inProgress ? 'Continue' : 'Start round';
  const actionIcon = locked ? 'lock' : graded ? 'visibility' : 'play_arrow';

  const click = () => { if (r) onOpen(r); };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, type: 'spring', stiffness: 130, damping: 16 }}
      className={`relative z-10 rounded-2xl border p-5 flex flex-col items-center text-center transition-shadow ${
        locked ? 'bg-surface-container/40 border-outline-variant/15' : 'bg-surface-container-lowest border-outline-variant/15 hover:shadow-lg'
      }`}>
      {/* medallion */}
      <div className="relative">
        <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center ring-4 ring-surface-container-lowest"
          style={{ background: locked ? '#9CA3AF' : meta.color }}>
          <span className="material-symbols-outlined text-white" style={{ fontSize: '2rem', fontVariationSettings: "'FILL' 1" }}>
            {locked ? 'lock' : meta.icon}
          </span>
        </div>
        <span className="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-on-surface text-surface text-xs font-black flex items-center justify-center">{index + 1}</span>
        {graded && (
          <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-white">
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', fontVariationSettings: "'FILL' 1" }}>check</span>
          </span>
        )}
      </div>

      <p className="mt-3 text-[0.6rem] font-bold uppercase tracking-widest" style={{ color: locked ? undefined : meta.color }}>{meta.label}</p>
      <p className="font-extrabold text-on-surface">{meta.node}</p>
      <p className="text-xs text-on-surface-variant mt-1 min-h-[2.5rem]">{meta.tagline}</p>

      {graded ? (
        <div className="my-2">
          <Stars score={r?.score ?? 0} size={16} />
          <p className="text-sm font-extrabold text-on-surface mt-1">{r?.score}<span className="text-on-surface-variant font-bold">/10</span></p>
        </div>
      ) : <div className="my-2 h-[1px]" />}

      <button onClick={click} disabled={locked || busy}
        className={`mt-auto w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
          locked ? 'bg-surface-container text-on-surface-variant/60 cursor-not-allowed'
          : graded ? 'bg-surface-container text-on-surface hover:bg-surface-container-high'
          : 'academic-gradient text-white shadow-md hover:opacity-90'
        }`}>
        {busy ? <span className="material-symbols-outlined animate-spin" style={{ fontSize: '1.1rem' }}>progress_activity</span>
          : <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>{actionIcon}</span>}
        {busy ? 'Loading…' : action}
      </button>
    </motion.div>
  );
}

// ── Play ─────────────────────────────────────────────────────────────────────

function PlayView({ active, prompt, setPrompt, grading, onSubmit, onBack, textareaRef }: {
  active: ActivePlay;
  prompt: string;
  setPrompt: (s: string) => void;
  grading: boolean;
  onSubmit: () => void;
  onBack: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const meta = arenaRoundMeta(active.round);
  const [showRecipe, setShowRecipe] = useState(true);
  const words = prompt.trim() ? prompt.trim().split(/\s+/).length : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5 relative">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm font-bold text-on-surface-variant hover:text-on-surface">
        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_back</span>Quest map
      </button>

      {/* Mission brief */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${meta.color} 0%, ${meta.color}cc 100%)` }}>
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, white 0, transparent 40%)' }} />
        <div className="relative">
          <div className="flex items-center gap-2 text-white/80 text-[0.6rem] font-bold uppercase tracking-[0.2em]">
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
            {meta.label} · {meta.node}
          </div>
          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-white/60 mt-3">Your mission</p>
          <p className="text-lg sm:text-xl font-extrabold leading-snug mt-1">{active.scenario}</p>
          {active.audience && (
            <p className="text-sm text-white/85 mt-2 inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>person</span>{active.audience}
            </p>
          )}
        </div>
      </div>

      {/* Recipe cheat sheet */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 overflow-hidden">
        <button onClick={() => setShowRecipe((s) => !s)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-on-surface">
          <span className="inline-flex items-center gap-2"><span className="material-symbols-outlined text-primary" style={{ fontSize: '1.2rem' }}>menu_book</span>Recipe cheat sheet</span>
          <span className="material-symbols-outlined text-on-surface-variant transition-transform" style={{ transform: showRecipe ? 'rotate(180deg)' : 'none' }}>expand_more</span>
        </button>
        <AnimatePresence initial={false}>
          {showRecipe && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-4 pb-4 space-y-2">
                {ARENA_INGREDIENTS.map((ing) => (
                  <div key={ing.key} className="flex gap-3 items-start">
                    <span className="material-symbols-outlined text-primary mt-0.5" style={{ fontSize: '1.2rem' }}>{ing.icon}</span>
                    <p className="text-sm text-on-surface-variant"><span className="font-bold text-on-surface">{ing.label}</span> — {ing.tip}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Prompt editor */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant">Write your prompt</label>
          <span className="text-[0.65rem] font-bold text-on-surface-variant tabular-nums">{words} words</span>
        </div>
        <textarea ref={textareaRef} value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={grading}
          placeholder="Act as a… Explain/Write… for… in the form of… in a … tone."
          className="w-full px-4 py-3.5 rounded-2xl bg-surface-variant/40 border border-outline-variant/20 outline-none focus:border-primary text-sm text-on-surface resize-none h-44 leading-relaxed" />
        <div className="flex justify-end mt-3">
          <button onClick={onSubmit} disabled={grading}
            className="px-6 py-3 text-sm font-bold academic-gradient text-white rounded-xl shadow-lg hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>auto_awesome</span>Submit for scoring
          </button>
        </div>
      </div>

      {/* Grading overlay */}
      <AnimatePresence>
        {grading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-sm flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }}
              className="bg-surface-container-lowest rounded-3xl p-8 text-center max-w-xs w-full shadow-2xl">
              <motion.span className="material-symbols-outlined academic-gradient bg-clip-text text-transparent"
                animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
                style={{ fontSize: '3rem' }}>auto_awesome</motion.span>
              <p className="font-extrabold text-on-surface mt-3">Scoring your prompt…</p>
              <p className="text-sm text-on-surface-variant mt-1">The AI judge is checking all 5 ingredients.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Reveal ───────────────────────────────────────────────────────────────────

function IngredientRow({ ing, value, delay }: { ing: typeof ARENA_INGREDIENTS[number]; value: number; delay: number }) {
  const pct = (value / 2) * 100;
  const color = value >= 2 ? '#22C55E' : value === 1 ? '#F59E0B' : '#EF4444';
  return (
    <div className="flex items-center gap-3">
      <span className="material-symbols-outlined text-on-surface-variant w-6 text-center" style={{ fontSize: '1.2rem' }}>{ing.icon}</span>
      <div className="w-20 shrink-0">
        <p className="text-xs font-extrabold text-on-surface tracking-wide">{ing.label}</p>
      </div>
      <div className="flex-1 h-2.5 rounded-full bg-surface-container overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: color }}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay, duration: 0.7, ease: 'easeOut' }} />
      </div>
      <span className="text-xs font-extrabold tabular-nums w-8 text-right" style={{ color }}>{value}/2</span>
    </div>
  );
}

function RevealView({ reveal, onBack, onNext }: { reveal: RevealData; onBack: () => void; onNext: () => void }) {
  const meta = arenaRoundMeta(reveal.round);
  const verdict = arenaVerdict(reveal.score);
  const isLast = reveal.round === 'hard';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
      {/* Score card */}
      <div className="relative rounded-3xl academic-gradient text-white p-7 sm:p-9 overflow-hidden text-center">
        {reveal.celebrate && <Confetti />}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 15%, white 0, transparent 45%), radial-gradient(circle at 75% 80%, white 0, transparent 40%)' }} />
        <div className="relative">
          <p className="text-[0.6rem] font-bold uppercase tracking-[0.25em] text-white/70">{meta.label} · {meta.node} — result</p>
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}
            className="mt-3 flex items-end justify-center gap-1">
            <CountUp value={reveal.score} className="text-6xl sm:text-7xl font-black leading-none" />
            <span className="text-2xl font-bold text-white/60 mb-2">/10</span>
          </motion.div>
          <div className="flex justify-center mt-3"><Stars score={reveal.score} /></div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-extrabold"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: verdict.color }} />{verdict.label}
          </motion.p>
        </div>
      </div>

      {/* Ingredient breakdown */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
        <p className="text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant mb-4">How your prompt scored</p>
        <div className="space-y-3">
          {ARENA_INGREDIENTS.map((ing, i) => (
            <IngredientRow key={ing.key} ing={ing} value={reveal.breakdown[ing.key]} delay={0.3 + i * 0.12} />
          ))}
        </div>
      </div>

      {/* Feedback */}
      {(reveal.strengths || reveal.fixes || reveal.feedback) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="grid sm:grid-cols-2 gap-3">
          {reveal.strengths && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/10 p-4">
              <p className="text-[0.6rem] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300 mb-1 inline-flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>thumb_up</span>What worked</p>
              <p className="text-sm text-emerald-900 dark:text-emerald-100">{reveal.strengths}</p>
            </div>
          )}
          {reveal.fixes && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/10 p-4">
              <p className="text-[0.6rem] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-1 inline-flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>lightbulb</span>Level up next time</p>
              <p className="text-sm text-amber-900 dark:text-amber-100">{reveal.fixes}</p>
            </div>
          )}
          {reveal.feedback && (
            <div className="sm:col-span-2 rounded-2xl bg-surface-container/50 p-4 text-sm text-on-surface-variant italic">
              “{reveal.feedback}”
            </div>
          )}
        </motion.div>
      )}

      {/* Your prompt */}
      {reveal.prompt && (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-5">
          <p className="text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Your prompt</p>
          <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">{reveal.prompt}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-surface-container text-on-surface text-sm font-bold hover:bg-surface-container-high">
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>map</span>Quest map
        </button>
        {!isLast ? (
          <button onClick={onNext} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl academic-gradient text-white text-sm font-bold shadow-md hover:opacity-90">
            Next round<span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_forward</span>
          </button>
        ) : (
          <Link to="/masterclass/leaderboard" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl academic-gradient text-white text-sm font-bold shadow-md hover:opacity-90">
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>leaderboard</span>See the leaderboard
          </Link>
        )}
      </div>
    </motion.div>
  );
}
