import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Horizontal row that may overflow (tabs, wide tables). When something is hidden on a side,
 * a fade and an arrow button show it, so nothing stays hidden without a visible cue.
 * The active item (aria-current / aria-selected) is kept in view.
 */
export function ScrollableRow({ children, className = '', outerClassName = '', fadeFrom = 'from-haven-cream', label = 'éléments', as: Tag = 'div', ariaLabel }: {
  children: ReactNode;
  className?: string;
  outerClassName?: string;
  /** Tailwind gradient start matching the background behind the row. */
  fadeFrom?: string;
  /** What is scrolled, for the arrow buttons' labels. */
  label?: string;
  as?: 'div' | 'nav';
  ariaLabel?: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const element = rail.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    setHidden({ left: element.scrollLeft > 4, right: element.scrollLeft < max - 4 });
  }, []);

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    Array.from(element.children).forEach(child => observer.observe(child));
    return () => observer.disconnect();
  }, [measure, children]);

  // Keep the selected tab visible, e.g. when a tab is opened from a link or a dashboard card.
  const lastActive = useRef<Element | null>(null);
  useEffect(() => {
    const element = rail.current;
    const active = element?.querySelector<HTMLElement>('[aria-current="page"], [aria-current="true"], [aria-selected="true"]');
    // Only when the selection changes: a manual scroll is never undone.
    if (!element || !active || active === lastActive.current) return;
    lastActive.current = active;
    const left = active.offsetLeft - element.offsetLeft;
    if (left < element.scrollLeft || left + active.offsetWidth > element.scrollLeft + element.clientWidth) {
      element.scrollTo({ left: Math.max(0, left - 24), behavior: 'smooth' });
    }
  });

  const scroll = (direction: 1 | -1) => {
    const element = rail.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.7, behavior: 'smooth' });
  };

  const arrow = (side: 'left' | 'right') => <div aria-hidden={!hidden[side]}
    className={`pointer-events-none absolute inset-y-0 z-10 flex items-center ${side === 'left' ? 'left-0 bg-gradient-to-r' : 'right-0 justify-end bg-gradient-to-l'} ${fadeFrom} to-transparent w-14 transition-opacity duration-200 ${hidden[side] ? 'opacity-100' : 'opacity-0'}`}>
    <button type="button" tabIndex={hidden[side] ? 0 : -1} onClick={() => scroll(side === 'left' ? -1 : 1)}
      aria-label={side === 'left' ? `Voir les ${label} précédents` : `Voir les ${label} suivants`}
      className={`${hidden[side] ? 'pointer-events-auto' : ''} flex h-11 w-11 items-center justify-center`}>
      {/* 44px touch target around a small visible circle. */}
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-haven-navy shadow-md">
        {side === 'left' ? <ChevronLeft size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
      </span>
    </button>
  </div>;

  return <div className={`relative min-w-0 ${outerClassName}`}>
    <Tag ref={rail as never} aria-label={ariaLabel} onScroll={measure} className={`overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {children}
    </Tag>
    {arrow('left')}
    {arrow('right')}
  </div>;
}
