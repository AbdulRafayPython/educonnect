import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../lib/useToast';
import { masterclassNav } from '../lib/nav';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { formatLocal } from '../lib/time';
import { cohortMeta, type AgeGroup } from '../lib/masterclass';

interface CertStatus {
  cohort_id: string | null;
  quizzes_total: number;
  quizzes_completed: number;
  sessions_total: number;
  sessions_attended: number;
  eligible: boolean;
  issued: boolean;
  pdf_path: string | null;
}

function Ring({ value, total, label, sub }: { value: number; total: number; label: string; sub: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--color-outline-variant,#E2E8F0)" strokeWidth="6" opacity={0.4} />
        <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" className="text-primary" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} transform="rotate(-90 44 44)" />
        <text x="44" y="40" textAnchor="middle" className="fill-on-surface" style={{ fontSize: 16, fontWeight: 700 }}>{value}/{total}</text>
        <text x="44" y="55" textAnchor="middle" className="fill-on-surface-variant" style={{ fontSize: 9 }}>{pct}%</text>
      </svg>
      <p className="text-xs font-bold text-on-surface mt-2">{label}</p>
      <p className="text-[0.65rem] text-on-surface-variant">{sub}</p>
    </div>
  );
}

export default function MasterclassProgress() {
  const { profile } = useAppStore();
  const toast = useToast();
  const ageGroup = profile?.age_group as AgeGroup | undefined;
  const cohortLabel = ageGroup ? cohortMeta[ageGroup].label : 'your';
  const [status, setStatus] = useState<CertStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.rpc('certificate_status');
    if (!error && data) setStatus(data as CertStatus);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const downloadCertificate = async () => {
    if (!status) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { generateCertificateBlob } = await import('../lib/certificate');
      const blob = await generateCertificateBlob({
        name: profile?.full_name || 'Student',
        cohortLabel,
        date: formatLocal(new Date().toISOString(), 'MMMM d, yyyy'),
        sessions: status.sessions_attended,
        quizzes: status.quizzes_completed,
      });
      const path = `${user.id}/${status.cohort_id}.pdf`;
      const { error: upErr } = await supabase.storage.from('certificates').upload(path, blob, { upsert: true, contentType: 'application/pdf' });
      if (upErr) { toast.error('Could not save certificate', upErr.message); setBusy(false); return; }
      const { error: rpcErr } = await supabase.rpc('issue_certificate', { p_pdf_path: path });
      if (rpcErr) { toast.error(rpcErr.message); setBusy(false); return; }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'EduConnect-Certificate.pdf'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Certificate ready!');
      load();
    } catch {
      toast.error('Certificate generation failed');
    } finally {
      setBusy(false);
    }
  };

  const badges = status ? [
    { icon: 'flag', label: 'First session', earned: status.sessions_attended >= 1 },
    { icon: 'task_alt', label: 'First quiz', earned: status.quizzes_completed >= 1 },
    { icon: 'trending_up', label: 'Halfway', earned: status.quizzes_total > 0 && status.quizzes_completed >= Math.ceil(status.quizzes_total / 2) },
    { icon: 'workspace_premium', label: 'All done', earned: status.eligible },
  ] : [];

  return (
    <DashboardLayout title="Progress" navItems={masterclassNav}>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">Your progress</h2>
          <p className="text-on-surface-variant text-sm mt-1">{cohortLabel} cohort · 12-week journey</p>
        </div>

        {loading ? (
          <div className="h-40 rounded-2xl bg-surface-container/40 animate-pulse" />
        ) : !status ? (
          <p className="text-on-surface-variant text-sm">Could not load progress.</p>
        ) : (
          <>
            {/* Rings */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-6 flex justify-around">
              <Ring value={status.quizzes_completed} total={status.quizzes_total} label="Quizzes" sub="completed" />
              <Ring value={status.sessions_attended} total={status.sessions_total} label="Sessions" sub="attended" />
            </div>

            {/* Badges */}
            <div>
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-3">Badges</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {badges.map((b) => (
                  <div key={b.label} className={`rounded-2xl border p-4 text-center transition-all ${b.earned ? 'border-primary/30 bg-primary/5' : 'border-outline-variant/20 opacity-50'}`}>
                    <div className={`mx-auto mb-2 w-11 h-11 rounded-2xl flex items-center justify-center ${b.earned ? 'bg-primary/15 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.4rem' }}>{b.icon}</span>
                    </div>
                    <p className="text-xs font-bold text-on-surface">{b.label}</p>
                    {b.earned && <p className="text-[0.6rem] font-bold uppercase tracking-widest text-primary mt-0.5">Earned</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Certificate */}
            <div className={`rounded-2xl p-6 ${status.eligible ? 'academic-gradient text-white' : 'border border-outline-variant/20 bg-surface-container-lowest'}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined" style={{ fontSize: '1.6rem' }}>workspace_premium</span>
                <h3 className="text-lg font-bold">Completion certificate</h3>
              </div>
              {status.eligible ? (
                <>
                  <p className="text-sm text-white/80 mb-5">You've completed every quiz — your certificate is ready to download.</p>
                  <button onClick={downloadCertificate} disabled={busy} className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary font-bold text-sm rounded-xl shadow-lg hover:bg-white/90 transition-all active:scale-[0.98] disabled:opacity-70">
                    {busy ? <><span className="material-symbols-outlined animate-spin text-base">progress_activity</span>Preparing…</> : <><span className="material-symbols-outlined text-base">download</span>{status.issued ? 'Download again' : 'Download your certificate'}</>}
                  </button>
                </>
              ) : (
                <p className="text-sm text-on-surface-variant">
                  Complete all {status.quizzes_total || 12} quizzes to unlock your certificate.
                  {status.quizzes_total > 0 && ` You're at ${status.quizzes_completed} of ${status.quizzes_total}.`}
                </p>
              )}
            </div>
          </>
        )}
      </div>
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </DashboardLayout>
  );
}
