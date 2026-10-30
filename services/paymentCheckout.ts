import type { Booking } from '../types';
import { assertBookingPayable, paymentDisposition } from './bookingLifecycle';
import type { PaymentMode } from './paymentConfiguration';

export interface CheckoutDetails {
  mode: PaymentMode;
  isTest?: boolean;
  booking: Booking;
  listing: { title: string; city: string; image: string };
  customer: { name: string; email: string };
  expiresAt: number | null;
}
export interface PaymentReceipt {
  bookingId: string;
  sessionId: string;
  provider: PaymentMode;
  amountCents: number;
  currency: string;
  isTest: boolean;
}
export function simulationSessionId(bookingId: string) { return `sim_${bookingId}`; }

export function preparePaymentConfirmation(booking: Booking, receipt: PaymentReceipt, now = new Date()) {
  if (booking.id !== receipt.bookingId || receipt.currency.toLowerCase() !== 'eur' || !Number.isSafeInteger(receipt.amountCents) || receipt.amountCents <= 0) return { disposition: 'REFUND' as const };
  if (receipt.provider === 'SIMULATION' && !receipt.isTest) return { disposition: 'REFUND' as const };
  const expectedSession = booking.checkoutSessionId || booking.stripeSessionId;
  const expectedProvider = booking.paymentProvider || (booking.stripeSessionId?.startsWith('mock_') ? 'SIMULATION' : 'STRIPE');
  if (expectedProvider !== receipt.provider || !expectedSession) return { disposition: 'REFUND' as const };
  const disposition = paymentDisposition({ ...booking, stripeSessionId: expectedSession }, receipt.sessionId, receipt.amountCents, now.getTime());
  if (disposition !== 'CONFIRM') return { disposition };
  assertBookingPayable(booking, booking.tenantId, now.getTime());
  const paidAt = now.toISOString();
  return {
    disposition,
    bookingUpdate: { status: 'CONFIRMED' as const, paymentStatus: 'PAID' as const, paidAt, paymentProvider: receipt.provider, paymentIsTest: receipt.isTest, checkoutSessionId: receipt.sessionId },
    payment: { id: receipt.sessionId, bookingId: booking.id, listingId: booking.listingId, ownerId: booking.ownerId, tenantId: booking.tenantId, amount: receipt.amountCents / 100, currency: 'EUR', provider: receipt.provider, isTest: receipt.isTest, status: 'COMPLETED' as const, type: 'RENT' as const, createdAt: paidAt },
    availability: { id: booking.id, bookingId: booking.id, listingId: booking.listingId, roomId: booking.roomId, startDate: booking.startDate, endDate: booking.endDate, status: 'CONFIRMED' as const, updatedAt: paidAt },
    message: { id: `m-payment-${booking.id}`, bookingId: booking.id, senderId: booking.ownerId, receiverId: booking.tenantId, content: receipt.provider === 'SIMULATION' ? 'Réservation confirmée après simulation du paiement. Aucun débit bancaire n’a été effectué.' : 'Paiement confirmé : votre réservation est confirmée. Retrouvez votre séjour et vos informations d’arrivée dans votre tableau de bord.', timestamp: paidAt, isRead: false, participants: [booking.tenantId, booking.ownerId] }
  };
}
