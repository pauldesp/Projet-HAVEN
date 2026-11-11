import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Appears softly when scrolled into view, once. Plain CSS transition: replaces a 120 KB animation
 * library on the home page. Respects "reduce motion"; content stays visible if observation is unavailable.
 */
export function Reveal({ children, className = '', from = 'up', delay = 0 }: { children: ReactNode; className?: string; from?: 'up' | 'scale'; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined'
    || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
  useEffect(() => {
    const element = ref.current;
    if (shown || !element) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setShown(true); observer.disconnect(); }
    }, { rootMargin: '0px 0px -40px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [shown]);
  // Once shown, the inline transform is removed so the element's own classes (e.g. scale) apply again.
  const style: CSSProperties = shown
    ? { transition: `opacity 500ms ease-out ${delay}ms, transform 500ms ease-out ${delay}ms` }
    : { opacity: 0, transform: from === 'up' ? 'translateY(20px)' : 'scale(0.95)' };
  return <div ref={ref} className={className} style={style}>{children}</div>;
}
