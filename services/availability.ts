import { BookingAvailability, Listing, Room } from '../types';
import { countNights } from './stay';

const BLOCKING_STATUSES = new Set<BookingAvailability['status']>(['PENDING', 'APPROVED', 'CONFIRMED']);

export function isRoomAvailableForStay(
  room: Room,
  listing: Pick<Listing, 'id' | 'blockedDates'>,
  availability: BookingAvailability[],
  startDate: string,
  endDate: string
): boolean {
  if (!room.isAvailable) return false;
  if (!startDate && !endDate) return true;
  if (countNights(startDate, endDate) < 1) return false;

  const hasBlockedDate = [...(room.blockedDates || []), ...(listing.blockedDates || [])]
    .some(date => date >= startDate && date < endDate);
  if (hasBlockedDate) return false;

  return !availability.some(booking =>
    booking.listingId === listing.id &&
    booking.roomId === room.id &&
    BLOCKING_STATUSES.has(booking.status) &&
    booking.startDate < endDate &&
    booking.endDate > startDate
  );
}

export function listingHasAvailableRoom(
  listing: Pick<Listing, 'id' | 'rooms' | 'blockedDates'>,
  availability: BookingAvailability[],
  startDate: string,
  endDate: string
): boolean {
  return listing.rooms.some(room => isRoomAvailableForStay(room, listing, availability, startDate, endDate));
}
