import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import DashboardLayout from '../components/DashboardLayout';
import { useAppStore } from '../store/useAppStore';
import { navForRole, feedBasePath } from '../lib/nav';
import {
  qk,
  fetchFeedItem,
  fetchMyFeedInteractions,
  type FeedInteraction,
} from '../lib/queries';
import { markRead, toggleSave, setReaction } from '../lib/feedActions';

const REACTION_EMOJI: Record<string, string> = {
  like: '👍',
  curious: '🤔',
  mind_blown: '🤯',
};

const REACTION_LABEL: Record<string, string> = {
  like: 'Useful',
  curious: 'Curious',
  mind_blown: 'Mind blown',
};

export default function FeedDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useAppStore((s) => s.role);
  const user = useAppStore((s) => s.user);
  const qc = useQueryClient();
  const basePath = feedBasePath(role);

  const itemQuery = useQuery({
    queryKey: qk.feedItem(id ?? ''),
    queryFn: () => fetchFeedItem(id!),
    enabled: !!id,
  });

  const interactionsQuery = useQuery({
    queryKey: qk.feedInteractions(user?.id ?? 'anon'),
    queryFn: () => (user ? fetchMyFeedInteractions(user.id) : Promise.resolve([])),
    enabled: !!user,
  });

  const interaction = useMemo<FeedInteraction | undefined>(
    () => interactionsQuery.data?.find((i) => i.item_id === id),
    [interactionsQuery.data, id]
  );

  // Auto-mark read after 1.5s on the page
  useEffect(() => {
    if (!user || !id || interaction?.is_read) return;
    const t = setTimeout(() => {
      markRead(id, user.id).then(() => qc.invalidateQueries({ queryKey: qk.feedInteractions(user.id) }));
    }, 1500);
    return () => clearTimeout(t);
  }, [id, user, interaction?.is_read, qc]);

  const saveMutation = useMutation({
    mutationFn: () => toggleSave(id!, user!.id, !!interaction?.is_saved),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.feedInteractions(user!.id) }),
  });

  const reactMutation = useMutation({
    mutationFn: (next: 'like' | 'curious' | 'mind_blown') =>
      setReaction(id!, user!.id, interaction?.reaction ?? null, next),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.feedInteractions(user!.id) }),
  });

  const item = itemQuery.data;
  const readingMinutes = useMemo(() => {
    if (!item) return 1;
    const wordCount = (item.body ?? item.summary).split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(wordCount / 200));
  }, [item]);

  if (itemQuery.isPending) {
    return (
      <DashboardLayout title="Reading…" navItems={navForRole(role)}>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="h-7 w-3/4 skeleton rounded" />
          <div className="h-4 w-1/3 skeleton rounded" />
          <div className="aspect-[16/9] skeleton rounded-2xl" />
          <div className="space-y-3">
            <div className="h-3 skeleton rounded" />
            <div className="h-3 skeleton rounded" />
            <div className="h-3 w-3/4 skeleton rounded" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (itemQuery.error || !item) {
    return (
      <DashboardLayout title="Not found" navItems={navForRole(role)}>
        <div className="max-w-3xl mx-auto text-center py-16">
          <h2 className="text-xl font-bold text-on-surface">Article not found</h2>
          <p className="text-sm text-on-surface-variant mt-2">It may have been removed.</p>
          <button
            onClick={() => navigate(basePath)}
            className="mt-6 px-5 py-2.5 rounded-xl academic-gradient text-white font-bold text-sm"
          >
            Back to feed
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="" navItems={navForRole(role)}>
      <article className="max-w-3xl mx-auto pb-12">
        {/* Back */}
        <Link
          to={basePath}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary/70 hover:text-primary mb-5"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>arrow_back</span>
          Back to feed
        </Link>

        {/* Meta */}
        <div className="flex items-center gap-2 text-[0.6875rem] uppercase tracking-wider font-bold text-on-surface-variant mb-3 flex-wrap">
          <span
            className={`px-2.5 py-1 rounded-full text-[0.6875rem] ${item.type === 'concept' ? 'bg-amber-500 text-white' : 'bg-primary text-white'}`}
          >
            {item.type === 'concept' ? 'Concept' : 'News'}
          </span>
          {item.source_name && <span>{item.source_name}</span>}
          <span className="text-outline-variant">•</span>
          <span>{formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}</span>
          <span className="text-outline-variant">•</span>
          <span>{readingMinutes} min read</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-on-surface tracking-tight leading-tight mb-6">
          {item.title}
        </h1>

        {/* Cover */}
        {item.cover_image_url && (
          <div className="aspect-[16/9] rounded-2xl overflow-hidden bg-surface-container mb-6 border border-outline-variant/30">
            <img src={item.cover_image_url} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Summary lead */}
        <p className="text-lg sm:text-xl text-on-surface leading-relaxed font-medium mb-8 pl-4 border-l-4 border-primary">
          {item.summary}
        </p>

        {/* Body (concepts) */}
        {item.body && (
          <div className="prose-content text-base text-on-surface leading-relaxed space-y-4 whitespace-pre-wrap">
            {item.body}
          </div>
        )}

        {/* Open original */}
        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-8 px-5 py-3 rounded-xl academic-gradient text-white font-bold text-sm tracking-wide hover:opacity-90 transition-all"
          >
            Open original
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>open_in_new</span>
          </a>
        )}

        {/* Action bar */}
        {user && (
          <footer className="mt-12 pt-6 border-t border-outline-variant/30 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {(['like', 'curious', 'mind_blown'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => reactMutation.mutate(r)}
                  className={`px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all press-shrink ${interaction?.reaction === r ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'bg-surface-container-lowest border border-outline-variant/30 text-on-surface-variant hover:border-primary/40'}`}
                >
                  <span className="text-base">{REACTION_EMOJI[r]}</span>
                  {REACTION_LABEL[r]}
                </button>
              ))}
            </div>
            <button
              onClick={() => saveMutation.mutate()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-sm font-bold text-on-surface hover:border-primary/40 transition-all"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '1.1rem', fontVariationSettings: interaction?.is_saved ? "'FILL' 1" : "'FILL' 0" }}
              >
                bookmark
              </span>
              {interaction?.is_saved ? 'Saved' : 'Save'}
            </button>
          </footer>
        )}
      </article>
    </DashboardLayout>
  );
}
