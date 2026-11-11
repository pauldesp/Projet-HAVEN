/**
 * Haven's in-house audience measurement, designed to fit the CNIL's exemption from consent:
 * anonymous statistics only, no cookie, no identifier sent, no IP stored, nothing shared with a third party.
 * The browser sends a few events; the server only keeps daily totals.
 */

export const FUNNEL_STEPS = ['visit', 'search', 'listing', 'booking_start', 'checkout', 'payment_return'] as const;
export type FunnelStep = typeof FUNNEL_STEPS[number];
export const FUNNEL_LABELS: Record<FunnelStep, string> = {
  visit: 'Visite', search: 'Recherche', listing: 'Fiche logement', booking_start: 'Réservation commencée', checkout: 'Paiement ouvert', payment_return: 'Paiement terminé',
};

export type Device = 'mobile' | 'tablet' | 'desktop';
export type AnalyticsEvent =
  | { type: 'session'; source: string; device: Device; landing: string }
  | { type: 'page'; page: string }
  | { type: 'search'; city: string; recurring: boolean }
  | { type: 'listing_view'; listingId: string }
  | { type: 'step'; step: FunnelStep }
  | { type: 'signup' };

/** Pages are grouped by kind: a listing's address or a booking reference never leaves the browser. */
export const PAGE_LABELS: Record<string, string> = {
  home: 'Accueil', search: 'Recherche', listing: 'Fiche logement', login: 'Connexion', tenant: 'Espace locataire', owner: 'Espace propriétaire',
  publish: 'Publier une annonce', payment: 'Paiement', account: 'Mon compte', messages: 'Messages', profile: 'Profil public', legal: 'Documents légaux',
  guide: 'Guides et aide', contact: 'Contact', recurring: 'Réservation récurrente', inventory: 'État des lieux', other: 'Autres pages',
};
export function pageKind(route: string): string | null {
  const path = (route.split('?')[0] || '/').replace(/^#/, '') || '/';
  if (path.startsWith('/admin') || path.startsWith('/debug')) return null; // the team's own pages are not measured
  if (path === '/') return 'home';
  const rules: [RegExp, string][] = [
    [/^\/search/, 'search'], [/^\/listing\//, 'listing'], [/^\/login/, 'login'], [/^\/dashboard/, 'tenant'],
    [/^\/owner\/(publish|edit)/, 'publish'], [/^\/owner/, 'owner'], [/^\/payment\//, 'payment'], [/^\/account/, 'account'],
    [/^\/(messages|inbox)/, 'messages'], [/^\/profile\//, 'profile'], [/^\/(legal|cookies)/, 'legal'],
    [/^\/(how-it-works|faq|help|trust-and-safety|partners|become-owner)/, 'guide'], [/^\/contact/, 'contact'],
    [/^\/reservation-recurrente/, 'recurring'], [/^\/inventory\//, 'inventory'],
  ];
  return rules.find(([pattern]) => pattern.test(path))?.[1] || 'other';
}

/** Where a visit comes from: the referring site's name only, or the campaign tag (utm_source). */
export function trafficSource(referrer: string, ownHost: string, utmSource?: string | null): string {
  const tag = (utmSource || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);
  if (tag) return tag;
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname.replace(/^(www|m|l|lm|out)\./, '');
    if (!host || host === ownHost.replace(/^www\./, '')) return 'direct';
    if (/(^|\.)google\./.test(host)) return 'google';
    if (/(^|\.)bing\.com$/.test(host)) return 'bing';
    if (/instagram\.com$/.test(host)) return 'instagram';
    if (/(facebook\.com|fb\.me)$/.test(host)) return 'facebook';
    if (/(linkedin\.com|lnkd\.in)$/.test(host)) return 'linkedin';
    if (/(t\.co|twitter\.com|x\.com)$/.test(host)) return 'x';
    if (/tiktok\.com$/.test(host)) return 'tiktok';
    if (/(whatsapp\.com|wa\.me)$/.test(host)) return 'whatsapp';
    if (/(stripe\.com)$/.test(host)) return 'direct'; // back from a payment, not a new source
    return host.slice(0, 40);
  } catch { return 'direct'; }
}

export const deviceFromWidth = (width: number): Device => width < 768 ? 'mobile' : width < 1100 ? 'tablet' : 'desktop';

const cleanKey = (value: string, max: number) => value.trim().replace(/\s+/g, ' ').slice(0, max);
const CITY = /^[\p{L}][\p{L}\s'’-]{0,58}$/u;

/** Server-side validation: anything unexpected is dropped rather than stored. */
export function validEvent(input: unknown): AnalyticsEvent | null {
  if (!input || typeof input !== 'object') return null;
  const event = input as Record<string, unknown>;
  switch (event.type) {
    case 'session': {
      const source = typeof event.source === 'string' ? cleanKey(event.source.toLowerCase(), 40) : '';
      const landing = typeof event.landing === 'string' && PAGE_LABELS[event.landing] ? event.landing : 'other';
      if (!/^[a-z0-9._-]{1,40}$/.test(source) || !['mobile', 'tablet', 'desktop'].includes(String(event.device))) return null;
      return { type: 'session', source, device: event.device as Device, landing };
    }
    case 'page': return typeof event.page === 'string' && PAGE_LABELS[event.page] ? { type: 'page', page: event.page } : null;
    case 'search': {
      const city = typeof event.city === 'string' ? cleanKey(event.city, 60) : '';
      return CITY.test(city) ? { type: 'search', city: city.charAt(0).toLocaleUpperCase('fr') + city.slice(1), recurring: event.recurring === true } : null;
    }
    case 'listing_view': return typeof event.listingId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(event.listingId) ? { type: 'listing_view', listingId: event.listingId } : null;
    case 'step': return FUNNEL_STEPS.includes(event.step as FunnelStep) ? { type: 'step', step: event.step as FunnelStep } : null;
    case 'signup': return { type: 'signup' };
    default: return null;
  }
}

/** Daily totals, the only thing stored. */
export interface AnalyticsDay {
  date: string;
  sessions: number;
  pageviews: number;
  signups: number;
  recurringSearches: number;
  pages: Record<string, number>;
  sources: Record<string, number>;
  devices: Record<string, number>;
  landings: Record<string, number>;
  cities: Record<string, number>;
  listings: Record<string, number>;
  funnel: Record<string, number>;
  hours: Record<string, number>;
}
export type AnalyticsDelta = { [K in keyof Omit<AnalyticsDay, 'date'>]?: AnalyticsDay[K] };

const bump = (map: Record<string, number> | undefined, key: string, by = 1) => ({ ...(map || {}), [key]: ((map || {})[key] || 0) + by });

/** Adds events to an in-memory delta (flushed to the database every minute). */
export function addToDelta(delta: AnalyticsDelta, events: AnalyticsEvent[], hour: number): AnalyticsDelta {
  const next: AnalyticsDelta = { ...delta };
  for (const event of events) {
    if (event.type === 'session') {
      next.sessions = (next.sessions || 0) + 1;
      next.sources = bump(next.sources, event.source);
      next.devices = bump(next.devices, event.device);
      next.landings = bump(next.landings, event.landing);
      next.hours = bump(next.hours, String(hour));
      next.funnel = bump(next.funnel, 'visit');
    } else if (event.type === 'page') {
      next.pageviews = (next.pageviews || 0) + 1;
      next.pages = bump(next.pages, event.page);
    } else if (event.type === 'search') {
      next.cities = bump(next.cities, event.city);
      if (event.recurring) next.recurringSearches = (next.recurringSearches || 0) + 1;
    } else if (event.type === 'listing_view') {
      next.listings = bump(next.listings, event.listingId);
    } else if (event.type === 'step') {
      if (event.step !== 'visit') next.funnel = bump(next.funnel, event.step);
    } else if (event.type === 'signup') {
      next.signups = (next.signups || 0) + 1;
    }
  }
  return next;
}

/** Calendar day and hour in Paris, so a visit at 00:30 counts for the right day. */
export function parisDayAndHour(at = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(at).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** Sums daily totals over a period. */
export function sumDays(days: Partial<AnalyticsDay>[]): Omit<AnalyticsDay, 'date'> {
  const total: Omit<AnalyticsDay, 'date'> = { sessions: 0, pageviews: 0, signups: 0, recurringSearches: 0, pages: {}, sources: {}, devices: {}, landings: {}, cities: {}, listings: {}, funnel: {}, hours: {} };
  for (const day of days) {
    for (const key of ['sessions', 'pageviews', 'signups', 'recurringSearches'] as const) total[key] += Number(day[key]) || 0;
    for (const key of ['pages', 'sources', 'devices', 'landings', 'cities', 'listings', 'funnel', 'hours'] as const) {
      for (const [name, count] of Object.entries(day[key] || {})) total[key][name] = (total[key][name] || 0) + (Number(count) || 0);
    }
  }
  return total;
}

/** Biggest entries first, the rest grouped as "Autres". */
export function topEntries(map: Record<string, number>, limit: number): { key: string; count: number }[] {
  const sorted = Object.entries(map).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, limit).map(([key, count]) => ({ key, count }));
  const rest = sorted.slice(limit).reduce((sum, [, count]) => sum + count, 0);
  return rest > 0 ? [...top, { key: 'Autres', count: rest }] : top;
}

/** Relative change between two periods, null when there is nothing to compare with. */
export const change = (current: number, previous: number) => previous > 0 ? Math.round((current - previous) / previous * 100) : null;
