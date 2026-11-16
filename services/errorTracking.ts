/**
 * In-house error tracking: unexpected errors from browsers and from the server are grouped by
 * fingerprint, counted and shown in the back office; Haven is alerted the first time one appears.
 * No personal data is kept: e-mails, tokens, numbers and query strings are masked.
 */
export type ErrorSource = 'CLIENT' | 'SERVER';
export interface ErrorReportInput { source: ErrorSource; message: string; stack?: string; context?: string; path?: string; userAgent?: string }
export interface ErrorReport { fingerprint: string; source: ErrorSource; message: string; stack: string; context: string; path: string; browser: string }
export interface ErrorGroup extends Omit<ErrorReport, 'fingerprint'> {
  id: string; count: number; firstAt: string; lastAt: string; status: 'OPEN' | 'RESOLVED'; resolvedAt?: string; alertedAt?: string;
}

/** Masks what could identify someone or leak a secret. */
export function scrub(value: string) {
  return value
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[e-mail]')
    .replace(/\b(Bearer\s+)?(eyJ[\w-]+\.[\w-]+\.[\w-]+|sk_(live|test)_\w+|pk_(live|test)_\w+|whsec_\w+|re_\w{8,})/g, '[secret]')
    .replace(/\?[^\s)'"]*/g, '')
    .replace(/\b\d{6,}\b/g, '[n]');
}

/** Identifiers vary between occurrences of the same error: drop them before grouping. */
const normalise = (message: string) => message.toLowerCase()
  .replace(/\b(b|l|s|u)-[0-9a-f]{8,}\b/g, '<id>').replace(/\b[a-z0-9]{20,}\b/gi, '<id>').replace(/\d+/g, '<n>').replace(/\s+/g, ' ').trim();

/** Short stable hash (FNV-1a), enough to group identical errors. */
export function fingerprint(source: ErrorSource, message: string, stack = '') {
  const firstFrame = stack.split('\n').map(line => line.trim()).find(line => line.startsWith('at ') || line.includes('@')) || '';
  const key = `${source}|${normalise(message)}|${firstFrame.replace(/:\d+:\d+/g, '').replace(/\?[^\s)]*/g, '')}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index++) { hash ^= key.charCodeAt(index); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return `${source.toLowerCase()}-${hash.toString(16).padStart(8, '0')}`;
}

const browserName = (userAgent = '') => /Edg\//.test(userAgent) ? 'Edge' : /Firefox\//.test(userAgent) ? 'Firefox'
  : /Chrome\//.test(userAgent) ? (/Android/.test(userAgent) ? 'Chrome Android' : 'Chrome')
  : /Safari\//.test(userAgent) ? (/iPhone|iPad/.test(userAgent) ? 'Safari iPhone' : 'Safari') : userAgent ? 'Autre navigateur' : '';

/** Validates and cleans a report; null when it should be ignored. */
export function prepareErrorReport(input: Partial<ErrorReportInput> | null | undefined): ErrorReport | null {
  if (!input || (input.source !== 'CLIENT' && input.source !== 'SERVER') || typeof input.message !== 'string') return null;
  const message = scrub(input.message).trim().slice(0, 300);
  if (!message || IGNORED.some(pattern => pattern.test(message))) return null;
  const stack = typeof input.stack === 'string' ? scrub(input.stack).split('\n').slice(0, 8).join('\n').slice(0, 1500) : '';
  return {
    fingerprint: fingerprint(input.source, message, stack), source: input.source, message, stack,
    context: typeof input.context === 'string' ? scrub(input.context).slice(0, 120) : '',
    // Route only (hash part), never query strings.
    path: typeof input.path === 'string' ? scrub(input.path).slice(0, 120) : '',
    browser: browserName(typeof input.userAgent === 'string' ? input.userAgent : ''),
  };
}

/** Noise that says nothing about Haven's code: browser extensions, aborted loads, lost connections. */
const IGNORED = [
  /ResizeObserver loop/i, /^Script error\.?$/i, /extension:\/\//i, /Load failed$/i, /AbortError/i, /The user aborted a request/i,
  // Short network losses: every background task retries on its own and the monitoring tab tracks them.
  /ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED|socket hang up|UNAVAILABLE|DEADLINE_EXCEEDED|Failed to fetch|NetworkError/i,
];

/** Merges a new occurrence into its group. A resolved error that comes back is reopened. */
export function mergeErrorGroup(existing: ErrorGroup | undefined, report: ErrorReport, at: string): { group: ErrorGroup; isNew: boolean } {
  const { fingerprint: id, ...details } = report;
  if (!existing) return { group: { ...details, id, count: 1, firstAt: at, lastAt: at, status: 'OPEN' }, isNew: true };
  const reopened = existing.status === 'RESOLVED';
  const group: ErrorGroup = { ...existing, ...details, id, count: existing.count + 1, lastAt: at, status: 'OPEN' };
  if (reopened) delete group.resolvedAt;
  return { group, isNew: reopened };
}

/**
 * Lets through at most `limit` events per `windowMs` and counts the others.
 * Recording an error can itself fail (database unreachable, expired credentials) and raise a new
 * error: without this cap the two feed each other until the server runs out of memory.
 */
export function createRateGuard(limit: number, windowMs: number) {
  const times: number[] = [];
  let skipped = 0;
  return {
    allow(now = Date.now()) {
      while (times.length && times[0] <= now - windowMs) times.shift();
      if (times.length >= limit) { skipped++; return false; }
      times.push(now);
      return true;
    },
    /** How many events were refused since the previous call. */
    takeSkipped() { const count = skipped; skipped = 0; return count; },
  };
}

/** At most one alert per group, and no more than 10 alerts an hour overall. */
export function shouldAlert(isNew: boolean, recentAlerts: number) {
  return isNew && recentAlerts < 10;
}
