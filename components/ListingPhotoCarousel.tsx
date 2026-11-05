import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export function ListingPhotoCarousel({ photos, title, href }: { photos: string[]; title: string; href: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const gesture = useRef({ x: 0, y: 0, swiped: false });
  const [active, setActive] = useState(0);
  const showPhoto = (index: number) => {
    const element = rail.current;
    if (!element) return;
    const next = Math.max(0, Math.min(photos.length - 1, index));
    element.scrollTo({ left: next * element.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  return <>
    <div ref={rail} role="region" aria-roledescription="carrousel" aria-label={`Photos de ${title}`} tabIndex={photos.length > 1 ? 0 : undefined}
      className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      onScroll={event => { const element = event.currentTarget; if (element.clientWidth) setActive(Math.max(0, Math.min(photos.length - 1, Math.round(element.scrollLeft / element.clientWidth)))); }}
      onTouchStart={event => { const touch = event.touches[0]; gesture.current = { x: touch.clientX, y: touch.clientY, swiped: false }; }}
      onTouchMove={event => { const touch = event.touches[0]; const dx = Math.abs(touch.clientX - gesture.current.x); const dy = Math.abs(touch.clientY - gesture.current.y); if (dx > 8 && dx > dy) gesture.current.swiped = true; }}
      onClickCapture={event => { if (gesture.current.swiped) { event.preventDefault(); event.stopPropagation(); gesture.current.swiped = false; } }}
      onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); showPhoto(active + (event.key === 'ArrowRight' ? 1 : -1)); } }}>
      {photos.map((photo, index) => <Link key={`${photo}-${index}`} to={href} tabIndex={index === active ? 0 : -1} className="block h-full w-full shrink-0 snap-center" aria-label={`Ouvrir ${title}, photo ${index + 1} sur ${photos.length}`}>
        <img src={photo} alt={`${title} — photo ${index + 1} sur ${photos.length}`} loading={index === 0 ? 'eager' : 'lazy'} draggable={false} className="h-full w-full select-none object-cover" />
      </Link>)}
    </div>
    {photos.length > 1 && <div role="group" aria-label={`Choisir une photo de ${title}`} className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center">
      {photos.map((_, index) => <button key={index} type="button" aria-label={`Photo ${index + 1} sur ${photos.length} — ${title}`} aria-current={index === active ? 'true' : undefined} onClick={() => showPhoto(index)} className="flex h-8 w-6 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"><span className={`h-1 w-1 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.5)] transition-opacity ${index === active ? 'bg-white' : 'bg-white/55'}`} /></button>)}
    </div>}
  </>;
}
