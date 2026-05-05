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

export function DashboardContentSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-10 max-w-7xl mx-auto">
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-6 sm:pb-8 border-b border-outline-variant/30">
        <div className="space-y-2">
          <Skeleton className="h-7 sm:h-8 w-56 sm:w-72" />
          <Skeleton className="h-3 w-44 sm:w-64" />
        </div>
        <div className="flex gap-3 shrink-0">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-outline-variant/10 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="w-8 h-8 rounded-xl" />
            </div>
            <Skeleton className="h-7 sm:h-8 w-12" />
            <Skeleton className="h-2 w-24" />
          </div>
        ))}
      </section>

      <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-7 border border-outline-variant/10 space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-6 w-3/4 max-w-md" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 space-y-3">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 3 }).map((__, j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
