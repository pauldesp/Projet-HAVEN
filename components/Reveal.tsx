import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

const DURATION_MS = 700;

/**
 * Appears softly as it comes into view, once. It starts a little before the element reaches the screen,
 * so even a quick scroll never shows empty space, and it stays short and discreet: the motion accompanies
 * the content instead of holding it back. Respects "reduce motion"; content stays visible if observation is
 * unavailable. Once settled, the inline style is dropped so the element's own transitions (hover) work again.
 */
export function Reveal({ children, className = '', from = 'up', delay = 0 }: { children: ReactNode; className?: string; from?: 'up' | 'scale'; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const immediate = typeof IntersectionObserver === 'undefined'
    || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [shown, setShown] = useState(immediate);
  const [settled, setSettled] = useState(immediate);
  const wait = Math.min(delay, 120);
  useEffect(() => {
    const element = ref.current;
    if (shown || !element) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setShown(true); observer.disconnect(); }
    }, { rootMargin: '0px 0px 20% 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [shown]);
  useEffect(() => {
    if (!shown || settled) return;
    const timer = window.setTimeout(() => setSettled(true), DURATION_MS + wait + 50);
    return () => window.clearTimeout(timer);
  }, [shown, settled, wait]);
  const style: CSSProperties | undefined = settled ? undefined : shown
    ? { transition: `opacity ${DURATION_MS * 0.6}ms ease-out ${wait}ms, transform ${DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${wait}ms` }
    : { opacity: 0, transform: from === 'up' ? 'translateY(16px)' : 'scale(0.98)' };
  return <div ref={ref} className={className} style={style}>{children}</div>;
}
