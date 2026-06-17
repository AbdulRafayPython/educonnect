import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import Markdown from '../components/Markdown';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../lib/useToast';
import { masterclassNav } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { formatLocal } from '../lib/time';
import { isHomeworkOverdue, type MasterclassHomework, type HomeworkSubmission } from '../lib/masterclass';

export default function MasterclassHomeworkDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [hw, setHw] = useState<MasterclassHomework | null>(null);
  const [submission, setSubmission] = useState<HomeworkSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: h } = await supabase.from('masterclass_homework').select('*').eq('id', id).single();
    const { data: s } = await supabase.from('masterclass_homework_submissions').select('*').eq('homework_id', id).eq('user_id', user?.id ?? '').maybeSingle();
    setHw((h as MasterclassHomework) ?? null);
    const sub = (s as HomeworkSubmission) ?? null;
    setSubmission(sub);
    setText(sub?.text ?? '');
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const downloadAttachment = async () => {
    if (!hw?.attachment_path) return;
    const { data, error } = await supabase.storage.from('masterclass-materials').download(hw.attachment_path);
    if (error || !data) { toast.error('Download failed'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = hw.attachment_path.split('/').pop() || 'attachment'; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadMyFile = async () => {
    if (!submission?.file_path) return;
    const { data, error } = await supabase.storage.from('masterclass-submissions').download(submission.file_path);
    if (error || !data) { toast.error('Download failed'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = submission.file_path.split('/').pop() || 'submission'; a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (!hw) return;
    if (!text.trim() && !file) { toast.error('Write an answer or attach a file'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSubmitting(true);

    let file_path = submission?.file_path ?? null;
    if (file) {
      const path = `${user.id}/${hw.id}-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('masterclass-submissions').upload(path, file);
      if (upErr) { toast.error('Upload failed', upErr.message); setSubmitting(false); return; }
      file_path = path;
    }

    const { error } = await supabase.from('masterclass_homework_submissions').upsert({
      homework_id: hw.id,
      user_id: user.id,
      text: text.trim() || null,
      file_path,
      submitted_at: new Date().toISOString(),
      status: 'submitted',
    }, { onConflict: 'homework_id,user_id' });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Submitted! Your teacher will review it.');
    setFile(null);
    load();
  };

  if (loading) return <DashboardLayout title="Homework" navItems={masterclassNav}><div className="max-w-2xl mx-auto h-80 rounded-2xl bg-surface-container/40 animate-pulse" /></DashboardLayout>;
  if (!hw) return <DashboardLayout title="Homework" navItems={masterclassNav}><div className="max-w-2xl mx-auto text-center py-20"><p className="text-on-surface-variant">Homework not found.</p><button onClick={() => navigate('/masterclass/homework')} className="mt-4 text-sm font-bold text-primary hover:underline">← Back</button></div></DashboardLayout>;

  const graded = submission?.status === 'graded' || submission?.status === 'returned';
  const overdue = !submission && isHomeworkOverdue(hw.due_date);

  return (
    <DashboardLayout title={hw.week_number != null ? `Week ${hw.week_number} homework` : 'Homework'} navItems={masterclassNav}>
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/masterclass/homework')} className="inline-flex items-center gap-1 text-sm font-bold text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_back</span>Homework
        </button>

        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-[0.6rem] font-bold uppercase tracking-widest text-secondary/50">{hw.points != null ? `${hw.points} pts` : 'Review only'}</span>
            {hw.due_date && <span className={`text-[0.6rem] font-bold uppercase tracking-widest ${overdue ? 'text-error' : 'text-secondary/50'}`}>Due {formatLocal(hw.due_date, 'MMM d, h:mm a')}{overdue ? ' · Late' : ''}</span>}
          </div>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">{hw.title}</h2>
        </div>

        {/* Graded result */}
        {graded && (
          <div className="rounded-2xl academic-gradient text-white p-6">
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-white/70">Your result</p>
            {hw.points != null && submission?.score != null ? (
              <p className="text-3xl font-extrabold mt-1">{submission.score} <span className="text-lg text-white/70">/ {hw.points}</span></p>
            ) : (
              <p className="text-lg font-extrabold mt-1">Reviewed ✓</p>
            )}
            {submission?.feedback && <div className="mt-3 bg-white/10 rounded-xl p-3 text-sm"><p className="text-[0.6rem] font-bold uppercase tracking-widest text-white/60 mb-1">Feedback</p>{submission.feedback}</div>}
          </div>
        )}
        {submission && !graded && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary/10 text-primary text-sm font-medium">
            <span className="material-symbols-outlined text-base">hourglass_top</span>
            Submitted {formatLocal(submission.submitted_at, 'MMM d, h:mm a')} — awaiting review. You can still update it below.
          </div>
        )}

        {/* Instructions */}
        <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-primary/70" style={{ fontSize: '1.1rem' }}>description</span>
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Instructions</h3>
          </div>
          <Markdown source={hw.instructions_md} />
          {hw.attachment_path && (
            <button onClick={downloadAttachment} className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary text-sm font-bold rounded-xl hover:bg-primary/20">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>download</span>Download attachment
            </button>
          )}
        </div>

        {/* Submission area */}
        <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5 sm:p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{graded ? 'Your submission' : 'Your work'}</h3>

          {graded ? (
            <>
              {submission?.text && <p className="text-sm text-on-surface whitespace-pre-wrap bg-surface-variant/30 rounded-xl px-4 py-3 leading-relaxed">{submission.text}</p>}
              {submission?.file_path && (
                <button onClick={downloadMyFile} className="inline-flex items-center gap-2 px-4 py-2 bg-surface-container text-on-surface text-sm font-bold rounded-xl hover:bg-surface-container-high">
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>attach_file</span>{submission.file_path.split('/').pop()}
                </button>
              )}
              {!submission?.text && !submission?.file_path && <p className="text-sm text-on-surface-variant italic">No content.</p>}
            </>
          ) : (
            <>
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Typed answer</label>
                <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-surface-variant/40 border-none outline-none text-sm text-on-surface resize-none h-40" placeholder="Write your answer here…" />
              </div>
              <div>
                <label className="block text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Attach a file (optional)</label>
                {submission?.file_path && !file && (
                  <p className="text-xs text-on-surface-variant mb-1 flex items-center gap-1.5"><span className="material-symbols-outlined text-primary/70" style={{ fontSize: '1rem' }}>attach_file</span>{submission.file_path.split('/').pop()} — choose a new file to replace</p>
                )}
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary" />
              </div>
              <div className="flex justify-end">
                <button onClick={submit} disabled={submitting} className="px-6 py-3 text-sm font-bold academic-gradient text-white rounded-xl shadow-lg hover:opacity-90 disabled:opacity-60 flex items-center gap-2">
                  {submitting ? <><span className="material-symbols-outlined animate-spin text-base">progress_activity</span>Submitting…</> : <>{submission ? 'Update submission' : 'Submit homework'}<span className="material-symbols-outlined text-base">send</span></>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismiss} />
    </DashboardLayout>
  );
}
