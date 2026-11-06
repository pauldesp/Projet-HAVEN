import type { Booking, OwnerPayout } from '../types';
import { bookingCategory } from './bookingLifecycle';
import { ownerShare } from './money';

export interface OwnerFinanceStats {
  /** Net bank payouts confirmed paid by the payment provider. */
  totalRevenue: number;
  /** Actual scheduled/processing bank payouts, independent of stay dates. */
  pendingRevenue: number;
}

export function realOwnerPayouts(payouts: OwnerPayout[]): OwnerPayout[] {
  return payouts.filter(payout => payout.provider === 'STRIPE' && payout.isTest === false && payout.currency === 'EUR' &&
    Number.isSafeInteger(payout.amountCents) && payout.amountCents > 0 &&
    (payout.status !== 'PAID' || Boolean(payout.providerPayoutId && payout.paidAt && Number.isFinite(Date.parse(payout.paidAt)))));
}

export function calculateOwnerFinanceStats(payouts: OwnerPayout[]): OwnerFinanceStats {
  const records = [...new Map(realOwnerPayouts(payouts).map(payout => [payout.id, payout])).values()];
  const paidReferences = new Set<string>();
  let paid = 0, pending = 0;
  for (const payout of records) {
    // A tenant payment, a transfer to a Stripe balance or a simulation is not a bank payout.
    if (payout.status === 'PAID' && payout.providerPayoutId && payout.paidAt && Number.isFinite(Date.parse(payout.paidAt))) {
      if (!paidReferences.has(payout.providerPayoutId)) { paid += payout.amountCents; paidReferences.add(payout.providerPayoutId); }
    } else if (payout.status === 'PENDING' || payout.status === 'PROCESSING') pending += payout.amountCents;
  }
  return { totalRevenue: paid / 100, pendingRevenue: pending / 100 };
}

export const ownerPayoutStatusLabel = (status: OwnerPayout['status']) => ({
  PENDING: 'Virement en attente', PROCESSING: 'Virement en cours', PAID: 'Versé',
  FAILED: 'Virement échoué', CANCELLED: 'Virement annulé', REVERSED: 'Virement retourné',
})[status] || 'Statut indisponible';

export interface OwnerEarningsSummary {
  /** Real bank payouts paid during the current calendar month. */
  paidThisMonth: number;
  /** Owner share of reserved stays (paid or not) whose transfer has not started, plus real payouts in progress. */
  upcoming: number;
  /** Part of `upcoming` coming from simulated (test) payments. */
  upcomingSimulated: number;
  upcomingStays: number;
}

const isSimulated = (booking: Booking) => booking.paymentIsTest === true || booking.paymentProvider === 'SIMULATION';

export function ownerEarningsSummary(bookings: Booking[], payouts: OwnerPayout[], now = new Date()): OwnerEarningsSummary {
  const sameMonth = (value: string) => { const date = new Date(value); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); };
  const paidReferences = new Set<string>();
  let paidCents = 0, inProgressCents = 0;
  for (const payout of new Map(realOwnerPayouts(payouts).map(payout => [payout.id, payout])).values()) {
    if (payout.status === 'PAID' && payout.providerPayoutId && payout.paidAt && sameMonth(payout.paidAt)) {
      if (!paidReferences.has(payout.providerPayoutId)) { paidCents += payout.amountCents; paidReferences.add(payout.providerPayoutId); }
    } else if (payout.status === 'PENDING' || payout.status === 'PROCESSING') inProgressCents += payout.amountCents;
  }
  let upcomingCents = 0, simulatedCents = 0, upcomingStays = 0;
  for (const booking of bookings) {
    // The transfer to the owner starts once the arrival is recorded; from then on it is counted through payouts.
    if (!['PENDING', 'APPROVED', 'CONFIRMED'].includes(booking.status) || booking.checkInReportId || bookingCategory(booking, now) === 'PAST') continue;
    const share = ownerShare(booking);
    if (share === null) continue;
    const cents = Math.round(share * 100);
    upcomingCents += cents; upcomingStays++;
    if (isSimulated(booking)) simulatedCents += cents;
  }
  return { paidThisMonth: paidCents / 100, upcoming: (upcomingCents + inProgressCents) / 100, upcomingSimulated: simulatedCents / 100, upcomingStays };
}
