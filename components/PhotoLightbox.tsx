import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const SWIPE_DISTANCE = 50;

interface PhotoLightboxProps {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
}

export function PhotoLightbox({ photos, initialIndex, onClose }: PhotoLightboxProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [index, setIndex] = useState(initialIndex);
  const hasMany = photos.length > 1;

  const move = (step: number) => setIndex(current => (current + step + photos.length) % photos.length);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!hasMany) return;
    [index + 1, index - 1 + photos.length].forEach(neighbour => {
      new Image().src = photos[neighbour % photos.length];
    });
  }, [index, hasMany, photos]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
    else if (event.key === 'ArrowRight' && hasMany) move(1);
    else if (event.key === 'ArrowLeft' && hasMany) move(-1);
    else if (event.key === 'Tab') {
      const buttons = Array.from(dialogRef.current?.querySelectorAll('button') ?? []) as HTMLButtonElement[];
      const position = buttons.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      buttons[(position + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    }
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || !hasMany) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    if (Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(touch.clientY - start.y)) move(dx < 0 ? 1 : -1);
  };

  const controlClass = 'flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white';

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photos du logement"
      className="fixed inset-0 z-[120] flex flex-col bg-haven-navy/95 text-white touch-pinch-zoom"
      onKeyDown={handleKeyDown}
      onClick={onClose}
      onTouchStart={event => { touchStart.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex shrink-0 items-center justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:p-5">
        <p className="pl-2 text-sm font-bold" aria-live="polite">{index + 1} / {photos.length}</p>
        <button ref={closeRef} type="button" aria-label="Fermer les photos" className={controlClass} onClick={onClose}><X size={22} aria-hidden="true" /></button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-20 md:pb-8">
        <img
          src={photos[index]}
          alt={`Photo ${index + 1} sur ${photos.length} du logement`}
          draggable={false}
          className="max-h-full max-w-full rounded-xl object-contain"
          onClick={event => event.stopPropagation()}
        />
        {hasMany && <>
          <button type="button" aria-label="Photo précédente" className={`${controlClass} absolute left-3 top-1/2 -translate-y-1/2 md:left-5`} onClick={event => { event.stopPropagation(); move(-1); }}><ChevronLeft size={24} aria-hidden="true" /></button>
          <button type="button" aria-label="Photo suivante" className={`${controlClass} absolute right-3 top-1/2 -translate-y-1/2 md:right-5`} onClick={event => { event.stopPropagation(); move(1); }}><ChevronRight size={24} aria-hidden="true" /></button>
        </>}
      </div>
    </div>,
    document.body
  );
}
