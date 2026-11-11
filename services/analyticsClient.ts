import { deviceFromWidth, pageKind, trafficSource, type AnalyticsEvent, type FunnelStep } from './analytics';

/**
 * Sends anonymous audience events to Haven's server. No cookie and no identifier: a per-tab flag in
 * sessionStorage only avoids counting the same visit or the same funnel step twice. Never throws.
 */
const queue: AnalyticsEvent[] = [];
/** The same event twice within a second is one action (re-render, double effect): counted once. */
const recent = new Map<string, number>();
const repeated = (key: string) => {
  const now = Date.now(), last = recent.get(key);
  recent.set(key, now);
  return last !== undefined && now - last < 1000;
};
let timer: ReturnType<typeof setTimeout> | undefined;

const enabled = () => typeof window !== 'undefined' && !navigator.webdriver
  // Visitors who ask not to be tracked are not counted.
  && navigator.doNotTrack !== '1' && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl !== true;

const once = (key: string) => {
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, '1');
    return true;
  } catch { return true; }
};

function send() {
  timer = undefined;
  if (!queue.length) return;
  const body = JSON.stringify({ events: queue.splice(0, 20) });
  try {
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon?.('/api/analytics', blob)) void fetch('/api/analytics', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => undefined);
  } catch { /* measurement must never disturb the page */ }
  if (queue.length) timer = setTimeout(send, 1000);
}

function push(event: AnalyticsEvent) {
  if (!enabled()) return;
  queue.push(event);
  if (!timer) timer = setTimeout(send, 1500);
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', send);

/** Called on every route change. The first page of a visit also records where it came from. */
export function trackPage(route: string) {
  const page = pageKind(route);
  if (!page || repeated(`page:${route}`)) return;
  if (once('haven-visit')) {
    const utm = new URLSearchParams(window.location.search).get('utm_source')
      || new URLSearchParams(window.location.hash.split('?')[1] || '').get('utm_source');
    push({ type: 'session', source: trafficSource(document.referrer, window.location.hostname, utm), device: deviceFromWidth(window.innerWidth), landing: page });
  }
  push({ type: 'page', page });
}

/** A funnel step counts once per visit. */
export function trackStep(step: FunnelStep) {
  if (once(`haven-step-${step}`)) push({ type: 'step', step });
}

export function trackSearch(city: string, recurring: boolean, signature = '') {
  if (!city.trim() || repeated(`search:${city}:${recurring}:${signature}`)) return;
  push({ type: 'search', city: city.trim(), recurring });
  trackStep('search');
}

export function trackListingView(listingId: string) {
  if (once(`haven-listing-${listingId}`)) push({ type: 'listing_view', listingId });
  trackStep('listing');
}

export const trackSignup = () => push({ type: 'signup' });
