import { Booking, Listing } from '../types';

export const DEFAULT_CHECK_IN_TIME = '15:00';
export const DEFAULT_CHECK_OUT_TIME = '11:00';

const localScheduledDate = (dateValue: string, timeValue: string) => {
  const [year, month, day] = dateValue.slice(0, 10).split('-').map(Number);
  const [hours, minutes] = timeValue.split(':').map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0);
};

export const formatScheduledMoment = (date: Date) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

export const getInventoryTiming = (
  booking: Booking,
  listing: Pick<Listing, 'checkInTime' | 'checkOutTime'> | undefined,
  type: 'IN' | 'OUT',
  now = new Date(),
) => {
  const time = type === 'IN'
    ? listing?.checkInTime || DEFAULT_CHECK_IN_TIME
    : listing?.checkOutTime || DEFAULT_CHECK_OUT_TIME;
  const scheduledAt = localScheduledDate(type === 'IN' ? booking.startDate : booking.endDate, time);

  return {
    scheduledAt,
    scheduledTime: time,
    isAvailable: now.getTime() >= scheduledAt.getTime(),
    isEarlyDeparture: type === 'OUT' && now.getTime() < scheduledAt.getTime(),
  };
};
