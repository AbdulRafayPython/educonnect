import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import DashboardLayout from '../components/DashboardLayout';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAppStore } from '../store/useAppStore';
import { navForRole } from '../lib/nav';
import { supabase } from '../lib/supabase';
import { qk, fetchFeedSources, type FeedSource } from '../lib/queries';

interface SourceFormState {
  name: string;
  rss_url: string;
  brand_color: string;
}

const BLANK: SourceFormState = { name: '', rss_url: '', brand_color: '#00193c' };

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function TeacherFeedSources() {
  const role = useAppStore((s) => s.role);
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<SourceFormState>(BLANK);
  const [formError, setFormError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [pendingDelete, setPendingDelete] = useState<FeedSource | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { titles?: string[]; error?: string }>>({});

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const sourcesQuery = useQuery({ queryKey: qk.feedSources, queryFn: fetchFeedSources });

  const createMutation = useMutation({
    mutationFn: async (payload: SourceFormState) => {
      const { error } = await supabase.from('feed_sources').insert({
        name: payload.name.trim(),
        rss_url: payload.rss_url.trim(),
        brand_color: payload.brand_color,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.feedSources });
      setShowCreate(false);
      setForm(BLANK);
      setFormError(null);
      setToast('Source added');
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<FeedSource> }) => {
      const { error } = await supabase.from('feed_sources').update(patch).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: qk.feedSources });
      const previous = qc.getQueryData<FeedSource[]>(qk.feedSources);
      if (previous) {
        qc.setQueryData<FeedSource[]>(
          qk.feedSources,
          previous.map((s) => (s.id === id ? { ...s, ...patch } : s))
        );
      }
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.feedSources, ctx.previous);
      setErrorMsg(err.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.feedSources }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feed_sources').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.feedSources });
      setToast('Source deleted');
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const handleCreate = () => {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    if (!isValidUrl(form.rss_url)) {
      setFormError('A valid http(s) URL is required');
      return;
    }
    createMutation.mutate(form);
  };

  const startEditName = (source: FeedSource) => {
    setEditingNameId(source.id);
    setEditingNameValue(source.name);
  };

  const saveName = (source: FeedSource) => {
    const next = editingNameValue.trim();
    if (next && next !== source.name) {
      updateMutation.mutate({ id: source.id, patch: { name: next } });
    }
    setEditingNameId(null);
  };

  const handleTestFetch = async (source: FeedSource) => {
    setTestingId(source.id);
    setTestResults((prev) => ({ ...prev, [source.id]: {} }));
    try {
      const res = await fetch(source.rss_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, 'application/xml');
      const items = Array.from(xml.querySelectorAll('item, entry')).slice(0, 5);
      const titles = items
        .map((el) => el.querySelector('title')?.textContent?.trim() ?? '')
        .filter(Boolean);
      setTestResults((prev) => ({
        ...prev,
        [source.id]: titles.length ? { titles } : { error: 'Fetched, but no <title> elements found.' },
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fetch failed';
      setTestResults((prev) => ({
        ...prev,
        [source.id]: {
          error: `${msg}. CORS-blocked. Source will still be tested by the server cron.`,
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setToast('URL copied');
    } catch {
      setToast('Copy failed');
    }
  };

  const sources = sourcesQuery.data ?? [];

  return (
    <DashboardLayout title="Feed Sources" navItems={navForRole(role)}>
      <div className="space-y-6 max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-outline-variant/30">
          <div>
            <Link
              to="/teacher/feed"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary/70 hover:text-primary mb-2"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_back</span>
              Back to feed
            </Link>
            <h2 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">RSS Sources</h2>
            <p className="text-sm text-on-surface-variant mt-1.5">
              Manage which RSS feeds are ingested into the AI Feed.
            </p>
          </div>
          <button
            onClick={() => {
              setForm(BLANK);
              setFormError(null);
              setShowCreate(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl academic-gradient text-white font-bold text-sm hover:opacity-90 transition-all shadow-md"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
            Add source
          </button>
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

        {sourcesQuery.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl skeleton" />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-container flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '2rem' }}>
                rss_feed
              </span>
            </div>
            <h3 className="text-lg font-bold text-on-surface">No sources yet</h3>
            <p className="text-sm text-on-surface-variant mt-1">Add your first RSS source to start ingesting news.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sources.map((source) => {
              const result = testResults[source.id];
              return (
                <div
                  key={source.id}
                  className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-4 sm:p-5 space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <input
                        type="color"
                        value={source.brand_color ?? '#00193c'}
                        onChange={(e) =>
                          updateMutation.mutate({ id: source.id, patch: { brand_color: e.target.value } })
                        }
                        className="w-9 h-9 rounded-lg border border-outline-variant/40 cursor-pointer bg-transparent shrink-0"
                        aria-label="Brand color"
                      />
                      <div className="flex-1 min-w-0">
                        {editingNameId === source.id ? (
                          <input
                            autoFocus
                            value={editingNameValue}
                            onChange={(e) => setEditingNameValue(e.target.value)}
                            onBlur={() => saveName(source)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveName(source);
                              if (e.key === 'Escape') setEditingNameId(null);
                            }}
                            className="w-full text-base font-bold text-on-surface bg-surface-container rounded-lg px-2 py-1 outline-none ring-2 ring-primary/30"
                          />
                        ) : (
                          <button
                            onClick={() => startEditName(source)}
                            className="text-base font-bold text-on-surface hover:text-primary text-left truncate max-w-full block"
                          >
                            {source.name}
                          </button>
                        )}
                        <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-1">
                          <span className="truncate max-w-[280px] sm:max-w-md">{source.rss_url}</span>
                          <button
                            onClick={() => copyUrl(source.rss_url)}
                            className="text-primary hover:underline shrink-0"
                            aria-label="Copy URL"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>content_copy</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() =>
                          updateMutation.mutate({
                            id: source.id,
                            patch: { is_active: !source.is_active },
                          })
                        }
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                          source.is_active ? 'bg-primary' : 'bg-surface-container'
                        }`}
                        aria-label={source.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            source.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <button
                        onClick={() => handleTestFetch(source)}
                        disabled={testingId === source.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/30 text-xs font-bold text-on-surface-variant hover:border-primary/40 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
                          {testingId === source.id ? 'progress_activity' : 'play_arrow'}
                        </span>
                        Test fetch
                      </button>
                      <button
                        onClick={() => setPendingDelete(source)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-error hover:bg-error-container/40"
                        aria-label="Delete source"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant pt-2 border-t border-outline-variant/20">
                    <span>
                      Last fetched:{' '}
                      {source.last_fetched_at
                        ? formatDistanceToNow(new Date(source.last_fetched_at), { addSuffix: true })
                        : 'never'}
                    </span>
                    {source.consecutive_failures > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-bold">
                        <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>error</span>
                        {source.consecutive_failures} failures
                      </span>
                    )}
                  </div>

                  {result && (result.titles || result.error) && (
                    <div className="rounded-xl bg-surface-container px-4 py-3 text-xs space-y-1">
                      {result.error ? (
                        <p className="text-on-surface-variant">{result.error}</p>
                      ) : (
                        <>
                          <p className="font-bold uppercase tracking-wider text-primary/60 mb-1">
                            Latest 5 titles
                          </p>
                          <ul className="space-y-1 list-disc pl-5 text-on-surface">
                            {result.titles!.map((t, i) => (
                              <li key={i} className="line-clamp-1">{t}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add RSS source">
        <div className="space-y-4">
          {formError && (
            <div className="rounded-xl bg-error-container text-on-error-container px-3 py-2 text-sm">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              Name
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="The Verge"
              className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              RSS URL
            </label>
            <input
              value={form.rss_url}
              onChange={(e) => setForm({ ...form, rss_url: e.target.value })}
              placeholder="https://example.com/feed.xml"
              className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary/30 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
              Brand color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.brand_color}
                onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
                className="w-12 h-10 rounded-lg border border-outline-variant/40 cursor-pointer bg-transparent"
              />
              <span className="text-xs font-mono text-on-surface-variant">{form.brand_color}</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-5 py-2.5 text-sm font-bold text-on-surface-variant rounded-xl hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="px-5 py-2.5 text-sm font-bold rounded-xl academic-gradient text-white shadow-md disabled:opacity-50"
            >
              {createMutation.isPending ? 'Adding…' : 'Add source'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this source?"
        message={`"${pendingDelete?.name ?? ''}" will no longer be ingested. Existing items remain.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-on-surface text-surface-container-lowest px-5 py-3 rounded-xl shadow-2xl text-sm font-bold">
          {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
