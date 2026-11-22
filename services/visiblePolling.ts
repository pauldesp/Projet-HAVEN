/**
 * Refreshes at a regular interval only while the page is visible, and at once when the person comes back
 * to it. A tab forgotten overnight in the background no longer calls the server thousands of times.
 * Returns the cleanup to call when the component goes away.
 */
export function pollWhileVisible(run: () => void | Promise<unknown>, intervalMs: number) {
  const visible = () => document.visibilityState === 'visible';
  const tick = () => { if (visible()) void run(); };
  const timer = window.setInterval(tick, intervalMs);
  document.addEventListener('visibilitychange', tick);
  return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
}
