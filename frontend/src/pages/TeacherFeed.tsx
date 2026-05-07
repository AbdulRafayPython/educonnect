import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import DashboardLayout from '../components/DashboardLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAppStore } from '../store/useAppStore';
import { navForRole } from '../lib/nav';
import { supabase } from '../lib/supabase';
import {
  qk,
  fetchAllFeedItemsAdmin,
  type FeedItem,
} from '../lib/queries';

type StatusFilter = 'all' | 'news' | 'concepts' | 'hidden';

const PAGE_SIZE = 20;

interface InteractionRow {
  item_id: string;
  is_read: boolean;
  is_saved: boolean;
  reaction: string | null;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'published':
      return 'bg-primary/10 text-primary';
    case 'hidden':
      return 'bg-error-container text-on-error-container';
    case 'archived':
      return 'bg-surface-container text-on-surface-variant';
    case 'draft':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-surface-container text-on-surface-variant';
  }
}

function typeBadgeClass(type: string): string {
  return type === 'concept'
    ? 'bg-amber-500/90 text-white'
    : 'bg-on-surface/85 text-white';
}

export default function TeacherFeed() {
  const role = useAppStore((s) => s.role);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pendingDelete, setPendingDelete] = useState<FeedItem | null>(null);
  const [pendingResimplify, setPendingResimplify] = useState<FeedItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenuId]);

  const itemsQuery = useQuery({
    queryKey: qk.feedItemsAdmin,
    queryFn: fetchAllFeedItemsAdmin,
  });

  const filtered = useMemo(() => {
    const items = itemsQuery.data ?? [];
    return items.filter((it) => {
      if (filter === 'news') return it.type === 'news' && it.status !== 'hidden';
      if (filter === 'concepts') return it.type === 'concept' && it.status !== 'hidden';
      if (filter === 'hidden') return it.status === 'hidden';
      return true;
    });
  }, [itemsQuery.data, filter]);

  const visible = filtered.slice(0, visibleCount);

  const visibleIds = useMemo(() => visible.map((v) => v.id), [visible]);

  const interactionsQuery = useQuery({
    queryKey: ['feed-engagement', visibleIds.sort().join(',')],
    queryFn: async () => {
      if (visibleIds.length === 0) return [] as InteractionRow[];
      const { data, error } = await supabase
        .from('feed_interactions')
        .select('item_id, is_read, is_saved, reaction')
        .in('item_id', visibleIds);
      if (error) throw error;
      return (data ?? []) as InteractionRow[];
    },
    enabled: visibleIds.length > 0,
  });

  const engagementByItem = useMemo(() => {
    const m = new Map<string, { read: number; saved: number; reactions: number }>();
    (interactionsQuery.data ?? []).forEach((row) => {
      const cur = m.get(row.item_id) ?? { read: 0, saved: 0, reactions: 0 };
      if (row.is_read) cur.read++;
      if (row.is_saved) cur.saved++;
      if (row.reaction) cur.reactions++;
      m.set(row.item_id, cur);
    });
    return m;
  }, [interactionsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from('feed_items').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.feedItemsAdmin });
      qc.invalidateQueries({ queryKey: qk.feedItems });
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('feed_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.feedItemsAdmin });
      qc.invalidateQueries({ queryKey: qk.feedItems });
      setToast('Item deleted');
    },
    onError: (err: Error) => setErrorMsg(err.message),
  });

  const handleHide = (item: FeedItem) =>
    updateMutation.mutate({ id: item.id, patch: { status: 'hidden' } });
  const handleRestore = (item: FeedItem) =>
    updateMutation.mutate({ id: item.id, patch: { status: 'published' } });

  const handlePin = (item: FeedItem) => {
    const isPinned = item.pinned_until && new Date(item.pinned_until) > new Date();
    if (isPinned) {
      updateMutation.mutate({ id: item.id, patch: { pinned_until: null } });
      setToast('Unpinned');
    } else {
      const pinUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      updateMutation.mutate({ id: item.id, patch: { pinned_until: pinUntil } });
      setToast('Pinned for 24h');
    }
  };

  const handleRefreshFeed = async () => {
    setErrorMsg(null);
    setToast('Fetching new articles… this may take up to 60s');
    try {
      const { data, error } = await supabase.functions.invoke('ingest_feeds', { body: {} });
      if (error) throw error;
      const summary = data as
        | { ok?: boolean; status?: string; items_inserted?: number; llm_calls?: number; errors?: { message: string }[] }
        | null;
      if (summary?.status === 'started') {
        setToast('Ingest started — refreshing list in ~30s');
        // Poll for new items a few times so the UI updates without a manual reload.
        const start = (itemsQuery.data ?? []).length;
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 10_000));
          const { data: latest } = await itemsQuery.refetch();
          if ((latest ?? []).length > start) {
            setToast(`Added ${(latest ?? []).length - start} new items`);
            return;
          }
        }
        setToast('No new items yet — check back later');
        return;
      }
      if (summary && !summary.ok) {
        setErrorMsg(`Ingest failed: ${summary.errors?.[0]?.message ?? 'unknown error'}`);
      } else if (summary && (summary.items_inserted ?? 0) > 0) {
        setToast(`Inserted ${summary.items_inserted} items`);
        await itemsQuery.refetch();
      } else {
        setToast('Triggered — check back in a minute');
        await itemsQuery.refetch();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to trigger ingestion';
      setErrorMsg(msg);
    }
  };

  const handleResimplifyConfirm = () => {
    // TODO: when ingest_feeds Edge Function accepts { resimplify_id }, POST it here.
    setPendingResimplify(null);
    setToast('Feature coming soon');
  };

  const totalCount = (itemsQuery.data ?? []).length;

  return (
    <DashboardLayout title="AI Feed" navItems={navForRole(role)}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-outline-variant/30">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/60 mb-2">
              Curate news and concepts
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
              AI Feed
            </h2>
            <p className="text-sm text-on-surface-variant mt-1.5">
              Manage all feed items: hide, pin, edit concepts, and trigger ingestion.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/teacher/feed/sources"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-sm font-bold text-on-surface hover:border-primary/40 transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>rss_feed</span>
              Sources
            </Link>
            <button
              onClick={handleRefreshFeed}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-sm font-bold text-on-surface hover:border-primary/40 transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>refresh</span>
              Refresh feed now
            </button>
            <Link
              to="/teacher/feed/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl academic-gradient text-white font-bold text-sm hover:opacity-90 transition-all shadow-md"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
              New Concept
            </Link>
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

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'news', 'concepts', 'hidden'] as StatusFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setFilter(t);
                setVisibleCount(PAGE_SIZE);
              }}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                filter === t
                  ? 'bg-primary text-white'
                  : 'bg-surface-container-lowest border border-outline-variant/30 text-on-surface-variant hover:border-primary/40'
              }`}
            >
              {t === 'all' ? 'All' : t === 'news' ? 'News' : t === 'concepts' ? 'Concepts' : 'Hidden'}
            </button>
          ))}
          <span className="ml-auto self-center text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            {totalCount} total
          </span>
        </div>

        {itemsQuery.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl skeleton" />
            ))}
          </div>
        ) : itemsQuery.error ? (
          <div className="rounded-xl bg-error-container text-on-error-container px-4 py-3 text-sm">
            Failed to load feed items.
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-container flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '2rem' }}>
                inbox
              </span>
            </div>
            <h3 className="text-lg font-bold text-on-surface">No items</h3>
            <p className="text-sm text-on-surface-variant mt-1">
              Try changing the filter or refreshing the feed.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-container text-left text-[0.6875rem] uppercase tracking-wider font-bold text-on-surface-variant">
                    <th className="px-4 py-3 w-16">Cover</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3 w-24">Type</th>
                    <th className="px-4 py-3 w-40">Source</th>
                    <th className="px-4 py-3 w-24">Status</th>
                    <th className="px-4 py-3 w-32">Published</th>
                    <th className="px-4 py-3 w-40">Engagement</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => {
                    const engagement = engagementByItem.get(item.id);
                    const isPinned = !!(item.pinned_until && new Date(item.pinned_until) > new Date());
                    return (
                      <tr key={item.id} className="border-t border-outline-variant/20 hover:bg-surface-container/50">
                        <td className="px-4 py-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-container border border-outline-variant/30">
                            {item.cover_image_url ? (
                              <img
                                src={item.cover_image_url}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>
                                  {item.type === 'concept' ? 'lightbulb' : 'article'}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isPinned && (
                              <span className="material-symbols-outlined text-primary" style={{ fontSize: '1rem' }}>
                                push_pin
                              </span>
                            )}
                            <Link
                              to={`/teacher/feed/view/${item.id}`}
                              className="font-bold text-on-surface hover:text-primary line-clamp-1 max-w-md"
                            >
                              {item.title}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-[0.6875rem] font-bold uppercase tracking-wider ${typeBadgeClass(item.type)}`}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant truncate max-w-[160px]">
                          {item.source_name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-[0.6875rem] font-bold uppercase tracking-wider ${statusBadgeClass(item.status)}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant text-xs">
                          {formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                            <span className="inline-flex items-center gap-1">
                              <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>visibility</span>
                              {engagement?.read ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>bookmark</span>
                              {engagement?.saved ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>favorite</span>
                              {engagement?.reactions ?? 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === item.id ? null : item.id);
                            }}
                            className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center"
                            aria-label="Actions"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>more_vert</span>
                          </button>
                          {openMenuId === item.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-4 top-12 z-30 w-52 bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-xl py-2"
                            >
                              {item.type === 'concept' && (
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    navigate(`/teacher/feed/edit/${item.id}`);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-surface-container flex items-center gap-2"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>edit</span>
                                  Edit
                                </button>
                              )}
                              {item.status === 'published' && (
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleHide(item);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-surface-container flex items-center gap-2"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>visibility_off</span>
                                  Hide
                                </button>
                              )}
                              {(item.status === 'hidden' || item.status === 'archived') && (
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleRestore(item);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-surface-container flex items-center gap-2"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>restore</span>
                                  Restore
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handlePin(item);
                                }}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-surface-container flex items-center gap-2"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>push_pin</span>
                                {isPinned ? 'Unpin' : 'Pin 24h'}
                              </button>
                              {item.type === 'news' && (
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setPendingResimplify(item);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-surface-container flex items-center gap-2"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>auto_fix</span>
                                  Re-simplify
                                </button>
                              )}
                              <div className="border-t border-outline-variant/30 my-1" />
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setPendingDelete(item);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-error hover:bg-error-container/30 flex items-center gap-2"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>delete</span>
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {visible.map((item) => {
                const engagement = engagementByItem.get(item.id);
                const isPinned = !!(item.pinned_until && new Date(item.pinned_until) > new Date());
                return (
                  <div
                    key={item.id}
                    className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4 space-y-3"
                  >
                    <div className="flex gap-3">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-surface-container border border-outline-variant/30 shrink-0">
                        {item.cover_image_url ? (
                          <img src={item.cover_image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                            <span className="material-symbols-outlined">
                              {item.type === 'concept' ? 'lightbulb' : 'article'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[0.625rem] font-bold uppercase ${typeBadgeClass(item.type)}`}>
                            {item.type}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[0.625rem] font-bold uppercase ${statusBadgeClass(item.status)}`}>
                            {item.status}
                          </span>
                          {isPinned && (
                            <span className="material-symbols-outlined text-primary" style={{ fontSize: '0.95rem' }}>
                              push_pin
                            </span>
                          )}
                        </div>
                        <Link
                          to={`/teacher/feed/view/${item.id}`}
                          className="font-bold text-on-surface text-sm line-clamp-2"
                        >
                          {item.title}
                        </Link>
                        <p className="text-xs text-on-surface-variant mt-1">
                          {item.source_name ?? '—'} · {formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>visibility</span>
                        {engagement?.read ?? 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>bookmark</span>
                        {engagement?.saved ?? 0}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>favorite</span>
                        {engagement?.reactions ?? 0}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/20">
                      {item.type === 'concept' && (
                        <button
                          onClick={() => navigate(`/teacher/feed/edit/${item.id}`)}
                          className="text-xs font-bold text-primary px-3 py-1.5 rounded-lg bg-primary/10"
                        >
                          Edit
                        </button>
                      )}
                      {item.status === 'published' ? (
                        <button onClick={() => handleHide(item)} className="text-xs font-bold text-on-surface-variant px-3 py-1.5 rounded-lg bg-surface-container">
                          Hide
                        </button>
                      ) : (
                        <button onClick={() => handleRestore(item)} className="text-xs font-bold text-on-surface-variant px-3 py-1.5 rounded-lg bg-surface-container">
                          Restore
                        </button>
                      )}
                      <button onClick={() => handlePin(item)} className="text-xs font-bold text-on-surface-variant px-3 py-1.5 rounded-lg bg-surface-container">
                        {isPinned ? 'Unpin' : 'Pin 24h'}
                      </button>
                      {item.type === 'news' && (
                        <button onClick={() => setPendingResimplify(item)} className="text-xs font-bold text-on-surface-variant px-3 py-1.5 rounded-lg bg-surface-container">
                          Re-simplify
                        </button>
                      )}
                      <button onClick={() => setPendingDelete(item)} className="text-xs font-bold text-error px-3 py-1.5 rounded-lg bg-error-container/40 ml-auto">
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {visibleCount < filtered.length && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="px-5 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-sm font-bold text-on-surface hover:border-primary/40 transition-all"
                >
                  Load more ({filtered.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this item?"
        message={`"${pendingDelete?.title ?? ''}" will be permanently removed.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={!!pendingResimplify}
        title="Re-simplify this article?"
        message="The summary and body will be regenerated by the AI pipeline."
        confirmLabel="Re-simplify"
        onConfirm={handleResimplifyConfirm}
        onCancel={() => setPendingResimplify(null)}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-on-surface text-surface-container-lowest px-5 py-3 rounded-xl shadow-2xl text-sm font-bold">
          {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
