import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '../components/DashboardLayout';
import { SkeletonCard } from '../components/Skeleton';
import { FeedCard } from '../components/FeedCard';
import { useAppStore } from '../store/useAppStore';
import { navForRole, feedBasePath, feedSavedPath } from '../lib/nav';
import {
  qk,
  fetchFeedItems,
  fetchMyFeedInteractions,
  fetchFeedSources,
  type FeedItem,
  type FeedInteraction,
} from '../lib/queries';
import { toggleSave, setReaction } from '../lib/feedActions';

type TypeFilter = 'all' | 'news' | 'concept';
type DifficultyFilter = 'all' | 'foundations' | 'core' | 'advanced';

export default function Feed() {
  const role = useAppStore((s) => s.role);
  const user = useAppStore((s) => s.user);
  const qc = useQueryClient();

  const basePath = feedBasePath(role);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [diffFilter, setDiffFilter] = useState<DifficultyFilter>('all');
  const [activeSources, setActiveSources] = useState<string[]>([]);

  const itemsQuery = useQuery({ queryKey: qk.feedItems, queryFn: fetchFeedItems });
  const sourcesQuery = useQuery({ queryKey: qk.feedSources, queryFn: fetchFeedSources });
  const interactionsQuery = useQuery({
    queryKey: qk.feedInteractions(user?.id ?? 'anon'),
    queryFn: () => (user ? fetchMyFeedInteractions(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

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

  const filtered = useMemo(() => {
    const items = itemsQuery.data ?? [];
    return items.filter((it) => {
      if (typeFilter !== 'all' && it.type !== typeFilter) return false;
      if (diffFilter !== 'all' && it.difficulty !== diffFilter) return false;
      if (activeSources.length && (!it.source_id || !activeSources.includes(it.source_id))) return false;
      return true;
    });
  }, [itemsQuery.data, typeFilter, diffFilter, activeSources]);

  const saveMutation = useMutation({
    mutationFn: (item: FeedItem) =>
      toggleSave(item.id, user!.id, !!interactionsByItem.get(item.id)?.is_saved),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.feedInteractions(user!.id) }),
  });

  const reactMutation = useMutation({
    mutationFn: ({ item, reaction }: { item: FeedItem; reaction: 'like' | 'curious' | 'mind_blown' }) =>
      setReaction(item.id, user!.id, interactionsByItem.get(item.id)?.reaction ?? null, reaction),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.feedInteractions(user!.id) }),
  });

  return (
    <DashboardLayout title="AI Feed" navItems={navForRole(role)}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 border-b border-outline-variant/30">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/60 mb-2">Stay current</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
              What's happening in AI
            </h2>
            <p className="text-sm text-on-surface-variant mt-1.5">
              Curated news in plain language, plus the foundations you need to understand it.
            </p>
          </div>
          {(role === 'student' || role === 'student_group') && (
            <a
              href={feedSavedPath(role)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-sm font-bold text-on-surface hover:border-primary/40 transition-all"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>bookmark</span>
              Saved
            </a>
          )}
        </header>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'news', 'concept'] as TypeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all press-shrink ${typeFilter === t ? 'bg-primary text-white' : 'bg-surface-container-lowest border border-outline-variant/30 text-on-surface-variant hover:border-primary/40'}`}
            >
              {t === 'all' ? 'For you' : t === 'news' ? 'News' : 'Concepts'}
            </button>
          ))}
          <span className="w-px bg-outline-variant/40 mx-1" />
          {(['all', 'foundations', 'core', 'advanced'] as DifficultyFilter[]).map((d) => (
            <button
              key={d}
              onClick={() => setDiffFilter(d)}
              className={`px-3 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all press-shrink ${diffFilter === d ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'text-on-surface-variant hover:bg-surface-container'}`}
            >
              {d === 'all' ? 'Any level' : d}
            </button>
          ))}
        </div>

        {/* Source filter */}
        {(sourcesQuery.data?.length ?? 0) > 0 && (
          <details className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden">
            <summary className="px-5 py-3 cursor-pointer text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center justify-between">
              <span>Filter by source ({activeSources.length || 'all'})</span>
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>expand_more</span>
            </summary>
            <div className="px-5 pb-4 flex flex-wrap gap-2">
              {(sourcesQuery.data ?? []).map((s) => {
                const active = activeSources.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveSources((cur) =>
                        active ? cur.filter((id) => id !== s.id) : [...cur, s.id]
                      );
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all press-shrink ${active ? 'text-white' : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant hover:border-primary/40'}`}
                    style={active ? { backgroundColor: s.brand_color ?? '#00193c' } : undefined}
                  >
                    {s.name}
                  </button>
                );
              })}
              {activeSources.length > 0 && (
                <button
                  onClick={() => setActiveSources([])}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold text-error hover:bg-error/10"
                >
                  Clear
                </button>
              )}
            </div>
          </details>
        )}

        {/* Grid */}
        {itemsQuery.isPending ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : itemsQuery.error ? (
          <EmptyState
            icon="error"
            title="Couldn't load the feed"
            body="Something went wrong fetching items. Try refreshing the page."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="rss_feed"
            title="Nothing here yet"
            body={
              (itemsQuery.data?.length ?? 0) === 0
                ? "We're still gathering the first stories. Check back in an hour."
                : 'No items match your filters. Try widening them.'
            }
          />
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                interaction={interactionsByItem.get(item.id)}
                brandColor={item.source_id ? sourceById.get(item.source_id)?.brand_color : null}
                basePath={basePath}
                onToggleSave={user ? () => saveMutation.mutate(item) : undefined}
                onReact={user ? (it, r) => reactMutation.mutate({ item: it, reaction: r }) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="text-center py-16 sm:py-24">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-surface-container flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '2rem' }}>
          {icon}
        </span>
      </div>
      <h3 className="text-lg font-bold text-on-surface">{title}</h3>
      <p className="text-sm text-on-surface-variant mt-1 max-w-sm mx-auto">{body}</p>
    </div>
  );
}
