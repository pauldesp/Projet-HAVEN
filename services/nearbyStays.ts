import { BookingAvailability, Listing } from '../types';
import { listingHasAvailableRoom } from './availability';
import { countNights, localDateKey } from './stay';

export interface NearbyStay {
  startDate: string;
  endDate: string;
  offsetDays: number;
}

const shiftDate = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

/**
 * Finds the closest stay of the same duration for at least one room.
 * Equal distances favour the earlier dates, then the later dates.
 */
export function findClosestAvailableStay(
  listing: Pick<Listing, 'id' | 'rooms' | 'blockedDates'>,
  availability: BookingAvailability[],
  requestedStart: string,
  requestedEnd: string,
  now = new Date(),
  maxOffsetDays = 30
): NearbyStay | undefined {
  const nights = countNights(requestedStart, requestedEnd);
  if (!nights) return undefined;
  const today = localDateKey(now);

  for (let offset = 1; offset <= maxOffsetDays; offset += 1) {
    for (const signedOffset of [-offset, offset]) {
      const startDate = shiftDate(requestedStart, signedOffset);
      const endDate = shiftDate(startDate, nights);
      if (startDate < today) continue;
      if (listingHasAvailableRoom(listing, availability, startDate, endDate)) {
        return { startDate, endDate, offsetDays: signedOffset };
      }
    }
  }
  return undefined;
}
