import { useLanguage } from '../contexts/LanguageContext';

/** Two clipped views of the original logo keep the Haven lettering unchanged. */
export function SearchLoading({ message = 'Recherche des logements disponibles…' }: { message?: string }) {
  const { tr } = useLanguage();
  return <div role="status" aria-live="polite" className="flex min-h-[50vh] flex-col">
    <p className="text-gray-500">{tr(message)}</p>
    <div className="flex flex-1 items-center justify-center px-6 py-16" aria-hidden="true">
      <div className="flex w-full max-w-[300px] items-center" style={{ aspectRatio: '1367 / 417', transform: 'translateX(-10px)' }}>
        <div className="relative h-full shrink-0 motion-safe:animate-spin" style={{ width: '28.5296%', animationDuration: '2.8s' }}>
          <div className="absolute inset-0 overflow-hidden">
            <img src="/logo.png" alt="" draggable={false} className="absolute top-0 h-full max-w-none" style={{ width: '350.5128%', left: 0 }} />
          </div>
        </div>
        <div className="relative h-full flex-1 overflow-hidden" style={{ transform: 'translateX(20px)' }}>
          <img src="/logo.png" alt="" draggable={false} className="absolute top-0 h-full max-w-none" style={{ width: '139.9181%', left: '-39.9181%' }} />
        </div>
      </div>
    </div>
  </div>;
}
