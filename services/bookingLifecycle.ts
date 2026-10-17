import type { Booking, InventoryReport, Listing } from '../types';
import { getInventoryTiming, formatScheduledMoment } from './inventoryTiming';

export class BookingLifecycleError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export function bookingDeadline(booking: Booking): number | null {
  if (booking.paymentStatus === 'PAID') return null;
  if (booking.status === 'PENDING' && booking.checkoutExpiresAt && Number.isFinite(Date.parse(booking.checkoutExpiresAt))) return Date.parse(booking.checkoutExpiresAt);
  const start = booking.status === 'PENDING' ? booking.createdAt
    : booking.status === 'APPROVED' ? booking.approvedAt : undefined;
  if (!start) return null;
  const value = Date.parse(start);
  return Number.isFinite(value) ? value + (booking.status === 'PENDING' ? 30 * 60 * 1000 : 24 * 60 * 60 * 1000) : null;
}
export function isBookingExpired(booking: Booking, now = Date.now()): boolean {
  const deadline = bookingDeadline(booking);
  return deadline !== null && now >= deadline;
}
export function assertBookingPayable(booking: Booking, actorId: string, now = Date.now()) {
  if (booking.tenantId !== actorId) throw new BookingLifecycleError('Seul le locataire peut payer cette réservation.', 403);
  if (booking.paymentStatus === 'PAID') throw new BookingLifecycleError('Cette réservation est déjà payée.');
  if (!['PENDING', 'APPROVED'].includes(booking.status)) throw new BookingLifecycleError('Cette réservation ne peut pas être payée.');
  if (isBookingExpired(booking, now)) throw new BookingLifecycleError('Le délai de paiement est dépassé. Recommencez la réservation.');
}
export function prepareInventoryReport(booking: Booking, listing: Listing, actorId: string, input: InventoryReport, now = new Date()) {
  if (actorId !== booking.tenantId) throw new BookingLifecycleError('Seul le locataire peut valider son arrivée ou son départ.', 403);
  if (booking.status !== 'CONFIRMED' || booking.paymentStatus !== 'PAID') throw new BookingLifecycleError('Le paiement doit être confirmé avant l’arrivée ou le départ.');
  if (!['IN', 'OUT'].includes(input.type) || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.id || '')) throw new BookingLifecycleError('État des lieux invalide.', 422);
  if (input.tenantId !== booking.tenantId || input.ownerId !== booking.ownerId || input.bookingId !== booking.id) throw new BookingLifecycleError('Les participants ne correspondent pas à la réservation.', 422);
  if (booking.checkInReportId && input.type === 'IN' || booking.checkOutReportId && input.type === 'OUT') throw new BookingLifecycleError('Cet état des lieux a déjà été validé.');
  if (input.type === 'OUT' && !booking.checkInReportId) throw new BookingLifecycleError('Validez d’abord votre état des lieux d’entrée.');
  const timing = getInventoryTiming(booking, listing, input.type, now);
  const early = input.type === 'OUT' && timing.isEarlyDeparture && input.isEarlyDeparture && (input.earlyDepartureReason?.trim().length || 0) >= 10;
  if (!timing.isAvailable && !early) throw new BookingLifecycleError(`État des lieux disponible à partir du ${formatScheduledMoment(timing.scheduledAt)}.`);
  if (input.status !== 'COMPLETED' || !input.identityValidated || !input.signature || !Array.isArray(input.items)) throw new BookingLifecycleError('Terminez les validations de l’état des lieux.', 422);
  if (typeof input.comments !== 'string' || input.comments.length > 780 * 1024) throw new BookingLifecycleError('Les photos de l’état des lieux sont trop volumineuses.', 422);
  return { ...input, date: now.toISOString(), ...(input.type === 'OUT' ? { isEarlyDeparture: Boolean(early), scheduledDepartureAt: timing.scheduledAt.toISOString() } : {}) };
}
export function bookingCategory(booking: Booking, now = new Date()): 'UPCOMING' | 'CURRENT' | 'PAST' {
  if (['CANCELLED', 'COMPLETED'].includes(booking.status)) return 'PAST';
  if (['PENDING', 'APPROVED'].includes(booking.status)) return 'UPCOMING';
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return booking.startDate.slice(0, 10) > today ? 'UPCOMING' : 'CURRENT';
}

export function paymentDisposition(booking: Booking & { stripeSessionId?: string }, sessionId: string, amountCents: number, now = Date.now()): 'CONFIRM' | 'DUPLICATE' | 'REFUND' {
  if (booking.stripeSessionId !== sessionId || Math.round(booking.totalPrice * 100) !== amountCents) return 'REFUND';
  if (booking.paymentStatus === 'PAID') return 'DUPLICATE';
  if (isBookingExpired(booking, now) || !['PENDING', 'APPROVED'].includes(booking.status)) return 'REFUND';
  return 'CONFIRM';
}
