import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import type { FeedItem, FeedInteraction } from '../lib/queries';

interface FeedCardProps {
  item: FeedItem;
  interaction?: FeedInteraction;
  brandColor?: string | null;
  basePath: string;
  onToggleSave?: (item: FeedItem) => void;
  onReact?: (item: FeedItem, reaction: 'like' | 'curious' | 'mind_blown') => void;
}

const REACTION_EMOJI: Record<string, string> = {
  like: '👍',
  curious: '🤔',
  mind_blown: '🤯',
};

const DIFFICULTY_LABEL: Record<string, string> = {
  foundations: 'Foundations',
  core: 'Core',
  advanced: 'Advanced',
};

export function FeedCard({ item, interaction, brandColor, basePath, onToggleSave, onReact }: FeedCardProps) {
  const isPinned = item.pinned_until && new Date(item.pinned_until) > new Date();
  const isRead = !!interaction?.is_read;
  const isSaved = !!interaction?.is_saved;
  const fallbackGradient = brandColor
    ? `linear-gradient(135deg, ${brandColor} 0%, #00193c 100%)`
    : 'linear-gradient(135deg, #00193c 0%, #002d62 100%)';

  return (
    <article
      className={`group relative bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-hidden hover-lift ${isRead ? 'opacity-75' : ''}`}
    >
      {/* Cover */}
      <Link to={`${basePath}/${item.id}`} className="block relative aspect-[16/9] overflow-hidden bg-surface-container">
        {item.cover_image_url ? (
          <img
            src={item.cover_image_url}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: fallbackGradient }}
          >
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: '3rem' }}>
              {item.type === 'concept' ? 'lightbulb' : 'article'}
            </span>
          </div>
        )}
        {/* Type badge top-left */}
        <div className="absolute top-3 left-3 flex gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-bold uppercase tracking-wider backdrop-blur-md ${item.type === 'concept' ? 'bg-amber-500/90 text-white' : 'bg-on-surface/85 text-white'}`}
          >
            {item.type === 'concept' ? 'Concept' : 'News'}
          </span>
          {isPinned && (
            <span className="px-2.5 py-1 rounded-full text-[0.6875rem] font-bold uppercase tracking-wider backdrop-blur-md bg-primary/90 text-white flex items-center gap-1">
              <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>push_pin</span>
              Pinned
            </span>
          )}
        </div>
        {/* Save button top-right */}
        {onToggleSave && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onToggleSave(item);
            }}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-surface-container-lowest/95 backdrop-blur-md flex items-center justify-center border border-outline-variant/40 hover:bg-surface-container-lowest transition-all press-shrink"
            aria-label={isSaved ? 'Unsave' : 'Save'}
          >
            <span
              className="material-symbols-outlined text-on-surface"
              style={{ fontSize: '1.15rem', fontVariationSettings: isSaved ? "'FILL' 1" : "'FILL' 0" }}
            >
              bookmark
            </span>
          </button>
        )}
      </Link>

      {/* Body */}
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-[0.6875rem] uppercase tracking-wider font-bold text-on-surface-variant">
          {item.source_name && <span className="truncate max-w-[140px]">{item.source_name}</span>}
          {item.source_name && <span className="text-outline-variant">•</span>}
          <span>{formatDistanceToNow(new Date(item.published_at), { addSuffix: true })}</span>
          {item.difficulty && (
            <>
              <span className="text-outline-variant">•</span>
              <span className="text-primary">{DIFFICULTY_LABEL[item.difficulty]}</span>
            </>
          )}
        </div>
        <Link to={`${basePath}/${item.id}`} className="block">
          <h3 className="text-lg font-bold text-on-surface leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          <p className="text-sm text-on-surface-variant leading-relaxed mt-2 line-clamp-3">
            {item.summary}
          </p>
        </Link>

        {/* Reactions */}
        {onReact && (
          <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20">
            <div className="flex items-center gap-1.5">
              {(['like', 'curious', 'mind_blown'] as const).map((r) => (
                <button
                  key={r}
                  onClick={(e) => {
                    e.preventDefault();
                    onReact(item, r);
                  }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all press-shrink ${interaction?.reaction === r ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-surface-container'}`}
                  aria-label={`React ${r}`}
                  title={r}
                >
                  <span className="text-base">{REACTION_EMOJI[r]}</span>
                </button>
              ))}
            </div>
            <Link
              to={`${basePath}/${item.id}`}
              className="text-xs font-bold uppercase tracking-wider text-primary hover:underline underline-offset-4"
            >
              Read more →
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
