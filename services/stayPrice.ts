import type { BookingAvailability, Listing } from '../types';
import { isRoomAvailableForStay } from './availability';
import { countNights } from './stay';

/** Same total as checkout: one room, one cleaning contribution and Haven fees. */
export function cheapestStayPrice(listing: Listing, availability: BookingAvailability[], start: string, end: string) {
  const nights = countNights(start, end);
  if (!nights) return null;
  const rooms = listing.rooms.filter(room => isRoomAvailableForStay(room, listing, availability, start, end));
  if (!rooms.length) return null;
  const nightlyPrice = Math.min(...rooms.map(room => room.pricePerDay));
  const basePrice = nightlyPrice * nights;
  const cleaningFee = listing.cleaningFee || 0;
  const platformFee = Math.round(basePrice * 0.15);
  return { nights, nightlyPrice, basePrice, cleaningFee, platformFee, total: basePrice + cleaningFee + platformFee };
}
