/**
 * Placeholder shaped like the page that is loading (title, key figures, list), instead of a spinner on an
 * empty screen: the page feels already there and fills in, rather than not having started.
 */
const bar = 'rounded-full bg-haven-gray/70';

export function PageSkeleton({ variant = 'dashboard', label = 'Chargement…' }: { variant?: 'dashboard' | 'list'; label?: string }) {
  return <div role="status" aria-live="polite" className="mx-auto max-w-7xl animate-pulse px-4 py-8 sm:px-6 md:py-12">
    <span className="sr-only">{label}</span>
    <div className={`${bar} h-8 w-56 sm:w-72`} />
    <div className={`${bar} mt-3 h-4 w-40`} />
    {variant === 'dashboard' && <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4">
      {[0, 1].map(item => <div key={item} className="rounded-[1.75rem] border border-haven-gray/60 bg-white p-5 sm:p-6">
        <div className={`${bar} h-4 w-24`} />
        <div className={`${bar} mt-6 h-8 w-16`} />
      </div>)}
    </div>}
    <div className="mt-8 flex gap-5">{[0, 1, 2].map(item => <div key={item} className={`${bar} h-4 w-20`} />)}</div>
    <div className="mt-6 space-y-3">
      {[0, 1, 2].map(item => <div key={item} className="flex items-center gap-4 rounded-[1.75rem] border border-haven-gray/60 bg-white p-4">
        <div className="h-16 w-16 shrink-0 rounded-2xl bg-haven-gray/70" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className={`${bar} h-4 w-2/3`} />
          <div className={`${bar} h-3 w-1/3`} />
        </div>
      </div>)}
    </div>
  </div>;
}
