import type { Booking } from '../types';

/** A checkout attempt becomes a proprietor's reservation only after payment. */
export function isOwnerBookingVisible(booking: Pick<Booking, 'status' | 'paymentStatus' | 'seriesScheduled'>): boolean {
  // A later stay of an active recurring series is reserved even before its installment is charged.
  if (booking.seriesScheduled === true && booking.status === 'PENDING' && booking.paymentStatus !== 'PAID') return true;
  return booking.paymentStatus === 'PAID' && ['CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(booking.status);
}
export function isBookingVisibleToParticipant(booking: Booking, userId: string): boolean {
  return booking.tenantId === userId || (booking.ownerId === userId && isOwnerBookingVisible(booking));
}
