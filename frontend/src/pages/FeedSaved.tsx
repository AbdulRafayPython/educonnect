import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { SkeletonCard } from '../components/Skeleton';
import { FeedCard } from '../components/FeedCard';
import { useAppStore } from '../store/useAppStore';
import { navForRole, feedBasePath } from '../lib/nav';
import {
  qk,
  fetchSavedFeedItems,
  fetchMyFeedInteractions,
  fetchFeedSources,
  type FeedItem,
  type FeedInteraction,
} from '../lib/queries';
import { toggleSave, setReaction } from '../lib/feedActions';

export default function FeedSaved() {
  const role = useAppStore((s) => s.role);
  const user = useAppStore((s) => s.user);
  const qc = useQueryClient();
  const basePath = feedBasePath(role);

  const savedQuery = useQuery({
    queryKey: qk.feedSaved(user?.id ?? 'anon'),
    queryFn: () => (user ? fetchSavedFeedItems(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  const interactionsQuery = useQuery({
    queryKey: qk.feedInteractions(user?.id ?? 'anon'),
    queryFn: () => (user ? fetchMyFeedInteractions(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  const sourcesQuery = useQuery({ queryKey: qk.feedSources, queryFn: fetchFeedSources });

  const interactionsByItem = useMemo(() => {
    const m = new Map<string, FeedInteraction>();
    (interactionsQuery.data ?? []).forEach((i) => m.set(i.item_id, i));
    return m;
  }, [interactionsQuery.data]);

  const sourceById = useMemo(() => {
    const m = new Map<string, { name: string; brand_color: string | null }>();
    (sourcesQuery.data ?? []).forEach((s) => m.set(s.id, { name: s.name, brand_color: s.brand_color }));
    return m;
  }, [sourcesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (item: FeedItem) =>
      toggleSave(item.id, user!.id, !!interactionsByItem.get(item.id)?.is_saved),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.feedInteractions(user!.id) });
      qc.invalidateQueries({ queryKey: qk.feedSaved(user!.id) });
    },
  });

  const reactMutation = useMutation({
    mutationFn: ({ item, reaction }: { item: FeedItem; reaction: 'like' | 'curious' | 'mind_blown' }) =>
      setReaction(item.id, user!.id, interactionsByItem.get(item.id)?.reaction ?? null, reaction),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.feedInteractions(user!.id) }),
  });

  const items = savedQuery.data ?? [];

  return (
    <DashboardLayout title="Saved" navItems={navForRole(role)}>
      <div className="space-y-6 max-w-7xl mx-auto">
        <header className="flex items-center justify-between pb-6 border-b border-outline-variant/30">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/60 mb-2">Library</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">Saved articles</h2>
          </div>
          <Link
            to={basePath}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-sm font-bold text-on-surface hover:border-primary/40 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_back</span>
            Back to feed
          </Link>
        </header>

        {savedQuery.isPending ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 sm:py-24">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-container flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '2rem' }}>
                bookmark
              </span>
            </div>
            <h3 className="text-lg font-bold text-on-surface">Nothing saved yet</h3>
            <p className="text-sm text-on-surface-variant mt-1 max-w-sm mx-auto">
              Tap the bookmark icon on any article to keep it for later.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {items.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                interaction={interactionsByItem.get(item.id)}
                brandColor={item.source_id ? sourceById.get(item.source_id)?.brand_color : null}
                basePath={basePath}
                onToggleSave={() => saveMutation.mutate(item)}
                onReact={(it, r) => reactMutation.mutate({ item: it, reaction: r })}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
