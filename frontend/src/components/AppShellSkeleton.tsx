import { Skeleton } from './Skeleton';

/**
 * Renders the dashboard chrome (sidebar + topbar + content placeholders)
 * shown during the initial auth + profile fetch. Gives the user immediate
 * structural feedback instead of a blank screen.
 */
export default function AppShellSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-background flex">
      {/* Sidebar — visible on lg+, off-canvas on mobile so we just hide it */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-[100dvh] w-60 flex-col bg-surface-container-low z-40 border-r border-outline-variant/20">
        <div className="px-6 py-7 flex items-center gap-3">
          <div className="w-8 h-8 academic-gradient rounded-lg flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white" style={{ fontSize: '1rem' }}>school</span>
          </div>
          <span className="text-xl font-bold text-primary tracking-tight">EduConnect</span>
        </div>
        <nav className="flex-1 px-3 space-y-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
              <Skeleton className="w-5 h-5 rounded-md" />
              <Skeleton className="h-3 flex-1 max-w-[110px]" />
            </div>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-outline-variant/20">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="w-5 h-5 rounded-md" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 lg:ml-60">
        {/* TopBar */}
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between gap-2 px-3 sm:px-6 bg-surface-container-lowest/80 backdrop-blur-md border-b border-outline-variant/20 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="lg:hidden w-10 h-10 flex items-center justify-center">
              <Skeleton className="w-7 h-7 rounded-md" />
            </div>
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <Skeleton className="w-9 h-9 rounded-lg" />
          </div>
        </header>

        {/* Main content placeholders — generic dashboard layout */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto fade-in-up">
            {/* Greeting */}
            <div className="space-y-2">
              <Skeleton className="h-7 sm:h-8 w-56 sm:w-72" />
              <Skeleton className="h-3 w-44 sm:w-56" />
            </div>

            {/* Stat cards row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-outline-variant/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="w-9 h-9 rounded-xl" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-2 w-24" />
                </div>
              ))}
            </div>

            {/* Hero / next-up block */}
            <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-outline-variant/10 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-6 w-3/4 max-w-md" />
              <div className="flex flex-wrap gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>

            {/* Two-column section */}
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
        </main>
      </div>
    </div>
  );
}
