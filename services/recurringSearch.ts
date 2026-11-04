import type { BookingAvailability, Listing, Room } from '../types';
import { isRoomAvailableForStay } from './availability';
import { isBookableStay, countNights, localDateKey } from './stay';
import { minimumNights } from './minimumStay';
import { distanceKm, validCoordinates } from './proximity';

export type SearchPeriod = { start: string; end: string };
export type PeriodMatch = {
  requested: SearchPeriod;
  stay: SearchPeriod | null;
  offset: number;
  roomIds: string[];
  total: number | null;
  minimumNightsRequired?: number;
};
export type RecurringMatch = {
  periods: PeriodMatch[];
  availableCount: number;
  total: number;
  average: number;
  commonRoomIds: string[];
};

export function parseRecurringPeriods(params: URLSearchParams, now = new Date()): SearchPeriod[] {
  const raw = params.get('periods');
  if (!raw) return [];
  try {
    if (raw.length > 64000) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || data.length < 2 || data.length > 1000) return [];
    if (data.some(period => !period || typeof period.start !== 'string' || typeof period.end !== 'string' || !isBookableStay(period.start, period.end, now))) return [];
    const periods = data.map(({ start, end }) => ({ start, end })).sort((a, b) => a.start.localeCompare(b.start));
    if (periods.some((period, index) => index > 0 && period.start < periods[index - 1].end)) return [];
    return periods;
  } catch { return []; }
}

export function roomMatchesOptions(room: Room, options: string[]) {
  return options.every(option => Boolean(room[option as keyof Room]));
}

const shift = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

/** Quote only rooms available for the whole individual stay and matching every room filter. */
export function matchRecurringStays(listing: Listing, availability: BookingAvailability[], requested: SearchPeriod[], flexible = false, roomOptions: string[] = [], now = new Date()): RecurringMatch {
  const periods = requested.map((period, index): PeriodMatch => {
    const requiredNights = minimumNights(listing.minStay);
    if (countNights(period.start, period.end) < requiredNights) {
      return { requested: period, stay: null, offset: 0, roomIds: [], total: null, minimumNightsRequired: requiredNights };
    }
    for (const offset of flexible ? [0, -1, 1] : [0]) {
      const stay = { start: shift(period.start, offset), end: shift(period.end, offset) };
      if (stay.start < localDateKey(now) || countNights(stay.start, stay.end) < minimumNights(listing.minStay)) continue;
      if (requested.some((other, otherIndex) => otherIndex !== index && stay.start < other.end && other.start < stay.end)) continue;
      const rooms = listing.rooms.filter(room => roomMatchesOptions(room, roomOptions) && isRoomAvailableForStay(room, listing, availability, stay.start, stay.end));
      if (!rooms.length) continue;
      const base = Math.min(...rooms.map(room => room.pricePerDay)) * countNights(stay.start, stay.end);
      return { requested: period, stay, offset, roomIds: rooms.map(room => room.id), total: base + (listing.cleaningFee || 0) + Math.round(base * .15) };
    }
    return { requested: period, stay: null, offset: 0, roomIds: [], total: null };
  });
  const available = periods.filter(period => period.stay);
  const commonRoomIds = available.length ? available[0].roomIds.filter(id => available.every(period => period.roomIds.includes(id))) : [];
  const total = available.reduce((sum, period) => sum + (period.total ?? 0), 0);
  return { periods, availableCount: available.length, total, average: available.length ? total / available.length : 0, commonRoomIds };
}

export function recurringScore(listing: Listing, match: RecurringMatch, distance?: number) {
  const coverage = match.availableCount / Math.max(1, match.periods.length);
  const proximity = distance === undefined ? .5 : 1 / (1 + distance / 5);
  const rating = Math.max(0, Math.min(5, listing.rating || 0)) / 5;
  return proximity * .4 + coverage * .35 + rating * .2 + (match.commonRoomIds.length ? .05 : 0);
}

export function completionForPeriod(source: Listing, candidates: Listing[], availability: BookingAvailability[], period: SearchPeriod, roomOptions: string[] = [], now = new Date()) {
  return candidates.filter(candidate => candidate.id !== source.id && candidate.status === 'APPROVED')
    .flatMap(listing => {
      const match = matchRecurringStays(listing, availability, [period], false, roomOptions, now);
      const distance = validCoordinates(source.coordinates) && validCoordinates(listing.coordinates) ? distanceKm(source.coordinates, listing.coordinates) : undefined;
      if (!match.availableCount || (distance !== undefined ? distance > 50 : listing.city.toLocaleLowerCase('fr') !== source.city.toLocaleLowerCase('fr'))) return [];
      return [{ listing, stay: period, distance }];
    }).sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || b.listing.rating - a.listing.rating)[0];
}

export function recurringListingLink(id: string, stay: SearchPeriod, periods: SearchPeriod[], flexible = false) {
  const params = new URLSearchParams({ start: stay.start, end: stay.end });
  if (periods.length > 1) params.set('periods', JSON.stringify(periods));
  if (flexible) params.set('flex', '1');
  return `/listing/${id}?${params}`;
}
