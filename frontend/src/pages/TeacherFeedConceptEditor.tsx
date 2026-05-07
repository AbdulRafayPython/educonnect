import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '../components/DashboardLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAppStore } from '../store/useAppStore';
import { navForRole } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { qk, fetchFeedItem } from '../lib/queries';

type Difficulty = 'foundations' | 'core' | 'advanced';
type Status = 'draft' | 'published';

interface FormState {
  title: string;
  summary: string;
  body: string;
  cover_image_url: string;
  difficulty: Difficulty;
  status: Status;
}

const BLANK: FormState = {
  title: '',
  summary: '',
  body: '',
  cover_image_url: '',
  difficulty: 'core',
  status: 'draft',
};

const SUMMARY_MAX = 320;

export default function TeacherFeedConceptEditor() {
  const role = useAppStore((s) => s.role);
  const user = useAppStore((s) => s.user);
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState>(BLANK);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const itemQuery = useQuery({
    queryKey: qk.feedItem(id ?? ''),
    queryFn: () => fetchFeedItem(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    const item = itemQuery.data;
    if (!item) return;
    setForm({
      title: item.title ?? '',
      summary: item.summary ?? '',
      body: item.body ?? '',
      cover_image_url: item.cover_image_url ?? '',
      difficulty: (item.difficulty ?? 'core') as Difficulty,
      status: (item.status === 'published' ? 'published' : 'draft') as Status,
    });
  }, [itemQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (next: FormState) => {
      const payload: Record<string, unknown> = {
        type: 'concept',
        title: next.title.trim(),
        summary: next.summary.trim(),
        body: next.body,
        cover_image_url: next.cover_image_url.trim() || null,
        difficulty: next.difficulty,
        status: next.status,
        created_by: user?.id ?? null,
      };
      if (isEdit) {
        payload.id = id;
      } else {
        payload.published_at = new Date().toISOString();
      }
      const { data, error } = await supabase
        .from('feed_items')
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.feedItemsAdmin });
      qc.invalidateQueries({ queryKey: qk.feedItems });
      if (isEdit) qc.invalidateQueries({ queryKey: qk.feedItem(id!) });
      navigate('/teacher/feed');
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const { error } = await supabase.from('feed_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.feedItemsAdmin });
      qc.invalidateQueries({ queryKey: qk.feedItems });
      navigate('/teacher/feed');
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const handleSave = () => {
    setErrorMsg(null);
    if (!form.title.trim()) {
      setErrorMsg('Title is required');
      return;
    }
    if (!form.summary.trim()) {
      setErrorMsg('Summary is required');
      return;
    }
    if (form.summary.length > SUMMARY_MAX) {
      setErrorMsg(`Summary must be ${SUMMARY_MAX} characters or fewer`);
      return;
    }
    saveMutation.mutate(form);
  };

  if (isEdit && itemQuery.isPending) {
    return (
      <DashboardLayout title="Edit Concept" navItems={navForRole(role)}>
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="h-8 w-1/3 skeleton rounded" />
          <div className="h-64 skeleton rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (isEdit && itemQuery.error) {
    return (
      <DashboardLayout title="Edit Concept" navItems={navForRole(role)}>
        <div className="max-w-3xl mx-auto text-center py-16">
          <h2 className="text-xl font-bold text-on-surface">Concept not found</h2>
          <Link
            to="/teacher/feed"
            className="mt-6 inline-block px-5 py-2.5 rounded-xl academic-gradient text-white font-bold text-sm"
          >
            Back to feed
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={isEdit ? 'Edit Concept' : 'New Concept'} navItems={navForRole(role)}>
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-outline-variant/30">
          <div>
            <Link
              to="/teacher/feed"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary/70 hover:text-primary mb-2"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_back</span>
              Back to feed
            </Link>
            <h2 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
              {isEdit ? 'Edit Concept' : 'New Concept'}
            </h2>
            <p className="text-sm text-on-surface-variant mt-1.5">
              Concepts are evergreen explainers. News items are automated and not editable here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isEdit && (
              <button
                onClick={() => setPendingDelete(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-error-container text-on-error-container font-bold text-sm hover:opacity-90"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>delete</span>
                Delete
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl academic-gradient text-white font-bold text-sm hover:opacity-90 transition-all shadow-md disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>save</span>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </header>

        {errorMsg && (
          <div className="rounded-xl bg-error-container text-on-error-container px-4 py-3 text-sm flex items-start gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>error</span>
            <span className="flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="text-xs font-bold uppercase">
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor column */}
          <div className="space-y-5 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                Title
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="What is a transformer?"
                className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary/30 text-base font-bold"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Summary
                </label>
                <span
                  className={`text-xs font-mono ${
                    form.summary.length > SUMMARY_MAX
                      ? 'text-error font-bold'
                      : 'text-on-surface-variant'
                  }`}
                >
                  {form.summary.length} / {SUMMARY_MAX}
                </span>
              </div>
              <textarea
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="A short, plain-language abstract."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-y"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                Cover image URL
              </label>
              <input
                value={form.cover_image_url}
                onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
                placeholder="https://…"
                className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary/30 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                Difficulty
              </label>
              <div className="flex gap-2">
                {(['foundations', 'core', 'advanced'] as Difficulty[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setForm({ ...form, difficulty: d })}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      form.difficulty === d
                        ? 'bg-primary text-white shadow-md'
                        : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:border-primary/40'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                Status
              </label>
              <div className="flex gap-2">
                {(['draft', 'published'] as Status[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setForm({ ...form, status: s })}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                      form.status === s
                        ? 'bg-primary text-white shadow-md'
                        : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:border-primary/40'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                Body (Markdown)
              </label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder={'# Heading\n\nWrite the explainer here…'}
                rows={20}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary/30 font-mono text-sm leading-relaxed resize-y min-h-[400px]"
              />
            </div>
          </div>

          {/* Preview column */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-primary/60 mb-4">Preview</p>
            {form.cover_image_url && (
              <div className="aspect-[16/9] rounded-xl overflow-hidden bg-surface-container mb-4 border border-outline-variant/30">
                <img
                  src={form.cover_image_url}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="flex items-center gap-2 text-[0.6875rem] uppercase tracking-wider font-bold text-on-surface-variant mb-3 flex-wrap">
              <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white">Concept</span>
              <span className="text-primary">{form.difficulty}</span>
              <span className="text-outline-variant">•</span>
              <span>{form.status}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight leading-tight mb-4">
              {form.title || 'Untitled concept'}
            </h1>
            {form.summary && (
              <p className="text-base text-on-surface leading-relaxed font-medium mb-6 pl-4 border-l-4 border-primary">
                {form.summary}
              </p>
            )}
            <pre className="whitespace-pre-wrap font-sans text-sm text-on-surface leading-relaxed">
              {form.body || 'Body preview will appear here.'}
            </pre>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete}
        title="Delete this concept?"
        message={`"${form.title}" will be permanently removed.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          deleteMutation.mutate();
          setPendingDelete(false);
        }}
        onCancel={() => setPendingDelete(false)}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-on-surface text-surface-container-lowest px-5 py-3 rounded-xl shadow-2xl text-sm font-bold">
          {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
