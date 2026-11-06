import type { BookingAvailability, Listing, Room } from '../types';
import { isRoomAvailableForStay } from './availability';
import { minimumNights } from './minimumStay';
import { countNights, localDateKey } from './stay';

/** Even inside a gap, a stay lasts at least this many nights (or the listing minimum if lower). */
export const GAP_STAY_FLOOR_NIGHTS = 2;
const BLOCKING = new Set(['PENDING', 'APPROVED', 'CONFIRMED']);

const shift = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

type GapListing = Pick<Listing, 'id' | 'blockedDates' | 'minStay' | 'allowGapStays'>;

/** A night (the one starting on `date`) is taken by a booking or a blocked date of this room. */
function isNightTaken(room: Room, listing: GapListing, availability: BookingAvailability[], date: string) {
  if ((room.blockedDates || []).includes(date) || (listing.blockedDates || []).includes(date)) return true;
  return availability.some(item => item.listingId === listing.id && item.roomId === room.id && BLOCKING.has(item.status) && item.startDate <= date && date < item.endDate);
}

/**
 * True when the stay fills exactly the free nights between two occupations of the room.
 * Today counts as a left boundary, so last-minute gaps before the next booking qualify too.
 */
export function fillsGap(room: Room, listing: GapListing, availability: BookingAvailability[], startDate: string, endDate: string, now = new Date()) {
  const leftBounded = startDate === localDateKey(now) || isNightTaken(room, listing, availability, shift(startDate, -1));
  return leftBounded && isNightTaken(room, listing, availability, endDate);
}

/** Nights required for these dates in this room: the listing minimum, lowered to the gap it exactly fills. */
export function requiredNightsForStay(room: Room, listing: GapListing, availability: BookingAvailability[], startDate: string, endDate: string, now = new Date()) {
  const base = minimumNights(listing.minStay);
  const nights = countNights(startDate, endDate);
  if (nights >= base || listing.allowGapStays === false) return base;
  const floor = Math.min(base, GAP_STAY_FLOOR_NIGHTS);
  return nights >= floor && fillsGap(room, listing, availability, startDate, endDate, now) ? nights : base;
}

/** Free and long enough (minimum or exact gap) for this room. */
export function isRoomBookableForStay(room: Room, listing: GapListing, availability: BookingAvailability[], startDate: string, endDate: string, now = new Date()) {
  // Without dates (browsing), only availability matters, as before.
  if (!startDate && !endDate) return isRoomAvailableForStay(room, listing, availability, startDate, endDate);
  return isRoomAvailableForStay(room, listing, availability, startDate, endDate) &&
    countNights(startDate, endDate) >= requiredNightsForStay(room, listing, availability, startDate, endDate, now);
}

export function isGapStay(room: Room, listing: GapListing, availability: BookingAvailability[], startDate: string, endDate: string, now = new Date()) {
  return countNights(startDate, endDate) < minimumNights(listing.minStay) && isRoomBookableForStay(room, listing, availability, startDate, endDate, now);
}

export function listingHasBookableRoom(listing: GapListing & Pick<Listing, 'rooms'>, availability: BookingAvailability[], startDate: string, endDate: string, now = new Date()) {
  return listing.rooms.some(room => isRoomBookableForStay(room, listing, availability, startDate, endDate, now));
}
