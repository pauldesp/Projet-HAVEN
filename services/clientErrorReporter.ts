/** Sends unexpected browser errors to Haven's server (grouped in the back office). Never throws. */
const sent = new Set<string>();
const MAX_PER_PAGE = 15;

export function sendClientError(error: unknown, context: string) {
  if (typeof window === 'undefined' || typeof fetch === 'undefined' || sent.size >= MAX_PER_PAGE) return;
  const cause = error as { message?: unknown; stack?: unknown } | null | undefined;
  const message = typeof cause?.message === 'string' ? cause.message : typeof error === 'string' ? error : String(error);
  const key = `${context}|${message}`;
  if (sent.has(key)) return;
  sent.add(key);
  try {
    void fetch('/api/client-errors', {
      method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
      // The route only (hash), without query strings: no identifiers or tokens leave the browser.
      body: JSON.stringify({ message: message.slice(0, 500), stack: typeof cause?.stack === 'string' ? cause.stack.slice(0, 2000) : '', context, path: window.location.hash.split('?')[0].slice(0, 120) || '/' }),
    }).catch(() => undefined);
  } catch { /* reporting must never break the page */ }
}
