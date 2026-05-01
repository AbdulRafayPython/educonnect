interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 space-y-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2 w-1/3" />
        </div>
      </div>
      <div className="flex justify-between pt-3 border-t border-outline-variant/10">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-7 w-7 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 flex items-start gap-4">
      <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-2 w-2/3" />
        <Skeleton className="h-2 w-1/3" />
      </div>
      <Skeleton className="h-9 w-24 rounded-xl" />
    </div>
  );
}

export function SkeletonGrid({ count = 6, variant = 'card' }: { count?: number; variant?: 'card' | 'row' }) {
  return (
    <div className={variant === 'card' ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-5' : 'space-y-4'}>
      {Array.from({ length: count }).map((_, i) =>
        variant === 'card' ? <SkeletonCard key={i} /> : <SkeletonRow key={i} />
      )}
    </div>
  );
}
