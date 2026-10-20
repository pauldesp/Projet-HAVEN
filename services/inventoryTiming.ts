import { Booking, Listing } from '../types';
import { arrivalInstant } from './reservationFulfillment';

export const DEFAULT_CHECK_IN_TIME = '15:00';
export const DEFAULT_CHECK_OUT_TIME = '11:00';

export function stayLocalDate(now: Date, timeZone = 'Europe/Paris') {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export const formatScheduledMoment = (date: Date, timeZone = 'Europe/Paris') =>
  new Intl.DateTimeFormat('fr-FR', { timeZone, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);

export const getInventoryTiming = (
  booking: Booking,
  listing: Pick<Listing, 'checkInTime' | 'checkOutTime'> | undefined,
  type: 'IN' | 'OUT',
  now = new Date(),
) => {
  const timeZone = booking.timeZone || 'Europe/Paris';
  const time = type === 'IN'
    ? booking.checkInTime || listing?.checkInTime || DEFAULT_CHECK_IN_TIME
    : booking.checkOutTime || listing?.checkOutTime || DEFAULT_CHECK_OUT_TIME;
  const today = stayLocalDate(now, timeZone);
  const start = booking.startDate.slice(0, 10);
  const end = booking.endDate.slice(0, 10);
  const scheduledAt = arrivalInstant(type === 'IN' ? start : end, time, timeZone);
  const arrivalAt = arrivalInstant(start, booking.checkInTime || listing?.checkInTime || DEFAULT_CHECK_IN_TIME, timeZone);
  return {
    scheduledAt, scheduledTime: time, timeZone,
    isExpired: today > (type === 'IN' ? start : end),
    // Checkout is available throughout departure day, including before checkout time.
    isAvailable: type === 'IN' ? today === start && now >= scheduledAt : today === end,
    isEarlyDeparture: type === 'OUT' && today >= start && today < end && now >= arrivalAt,
  };
};
