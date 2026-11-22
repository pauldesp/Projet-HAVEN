import { useCallback, useRef } from 'react';
import type React from 'react';

/** Apple's projection of where a flick would come to rest (decelerationRate ≈ 0.998, like scrolling). */
const project = (velocityPxPerS: number, rate = 0.998) => (velocityPxPerS / 1000) * rate / (1 - rate);
/** Past an edge, the panel follows less and less: resistance instead of a hard stop. */
const rubberband = (overshoot: number, dimension: number, constant = 0.55) =>
  (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'; // iOS sheet curve: fast start, long soft settle

/**
 * Dialogs that rise from the bottom on phones: they can be dragged down by their top area and close with the
 * same path they came in (down on phones, a short fade elsewhere). The panel follows the finger 1:1, a flick
 * closes it, a short drag springs back. `requestClose` replaces direct calls to `onClose` (close button, backdrop).
 */
export function useSheet(onClose: () => void, { sheetBelow = 768 }: { sheetBelow?: number } = {}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const drag = useRef<{ id: number; startY: number; y: number; lastY: number; lastT: number; velocity: number } | null>(null);

  const isSheet = () => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${sheetBelow - 1}px)`).matches;
  const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const place = (y: number, animate: boolean, durationMs = 340) => {
    const panel = panelRef.current, backdrop = backdropRef.current;
    if (!panel) return;
    const transition = animate ? `transform ${durationMs}ms ${EASE}` : 'none';
    panel.style.transition = transition;
    panel.style.transform = y ? `translateY(${y}px)` : '';
    if (backdrop) {
      backdrop.style.transition = animate ? `opacity ${durationMs}ms ${EASE}` : 'none';
      backdrop.style.opacity = String(Math.max(0, 1 - Math.max(0, y) / Math.max(1, panel.offsetHeight)));
    }
  };

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const panel = panelRef.current, backdrop = backdropRef.current;
    if (!panel || reducedMotion()) { onClose(); return; }
    if (isSheet()) {
      place(panel.offsetHeight + 24, true, 280);
      window.setTimeout(onClose, 280);
    } else {
      panel.style.transition = `opacity 160ms ease-in, transform 160ms ease-in`;
      panel.style.opacity = '0';
      panel.style.transform = 'translateY(8px) scale(0.98)';
      if (backdrop) { backdrop.style.transition = 'opacity 160ms ease-in'; backdrop.style.opacity = '0'; }
      window.setTimeout(onClose, 160);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const dragProps: React.HTMLAttributes<HTMLDivElement> = {
    onPointerDown: event => {
      if (!isSheet() || closing.current || (event.target as HTMLElement).closest('button, a, input, select, textarea, label')) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { id: event.pointerId, startY: event.clientY, y: 0, lastY: event.clientY, lastT: performance.now(), velocity: 0 };
    },
    onPointerMove: event => {
      const state = drag.current;
      if (!state || state.id !== event.pointerId) return;
      const now = performance.now();
      const dy = event.clientY - state.startY;
      // Downward the panel follows the finger exactly; upward it resists.
      state.y = dy >= 0 ? dy : rubberband(dy, panelRef.current?.offsetHeight || 600);
      state.velocity = (event.clientY - state.lastY) / Math.max(1, now - state.lastT) * 1000;
      state.lastY = event.clientY; state.lastT = now;
      place(state.y, false);
    },
    onPointerUp: event => {
      const state = drag.current;
      if (!state || state.id !== event.pointerId) return;
      drag.current = null;
      const height = panelRef.current?.offsetHeight || 600;
      // Decide from where the gesture is heading, not where it stopped: a quick flick closes even if short.
      if (state.y + project(state.velocity) > height * 0.35) {
        closing.current = true;
        place(height + 24, true, 260);
        window.setTimeout(onClose, 260);
      } else place(0, true);
    },
    onPointerCancel: () => { if (drag.current) { drag.current = null; place(0, true); } },
    style: { touchAction: 'none' },
  };

  return { panelRef, backdropRef, dragProps, requestClose };
}
