import type { Booking } from '../types';

/** A checkout attempt becomes a proprietor's reservation only after payment. */
export function isOwnerBookingVisible(booking: Pick<Booking, 'status' | 'paymentStatus'>): boolean {
  return booking.paymentStatus === 'PAID' && ['CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(booking.status);
}
export function isBookingVisibleToParticipant(booking: Booking, userId: string): boolean {
  return booking.tenantId === userId || (booking.ownerId === userId && isOwnerBookingVisible(booking));
}
