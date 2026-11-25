import { parisDateKey } from './stay';
import type { Booking } from '../types';

export type CancellationActor = 'TENANT' | 'OWNER' | 'HAVEN';

export interface CancellationTerms {
  canCancel: boolean;
  daysBeforeArrival: number;
  refundPercent: number;
  refundAmount: number;
  /** Haven service fee kept on a partial refund (0 otherwise). */
  serviceFeeKept?: number;
  label: string;
  detail: string;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
/** An owner cancels alone only this early; afterwards only Haven can cancel. Independent of the tenant's tiers. */
export const OWNER_CANCELLATION_DAYS = 30;
/** Tenant tiers (conditions de réservation, art. 6): full refund when MORE than this many days remain… */
export const TENANT_FULL_REFUND_AFTER_DAYS = 14;
/** …half of the stay and cleaning from this many days up to the previous threshold, nothing below. */
export const TENANT_HALF_REFUND_FROM_DAYS = 8;

const cents = (value: number) => Math.round(value * 100) / 100;

// Calendar days compared at UTC midnight: a local midnight would lose an hour across the spring time change
// and count 29 days instead of 30.
const startOfDay = (value: string) => Date.parse(`${value.slice(0, 10)}T00:00:00Z`);

/**
 * HAVEN's first cancellation policy. Keeping this logic isolated makes the
 * commercial thresholds easy to change without altering the booking flow.
 */
export const getCancellationTerms = (
  booking: Pick<Booking, 'status' | 'startDate' | 'totalPrice' | 'paymentStatus'> & Partial<Pick<Booking, 'seriesScheduled' | 'platformFee'>>,
  actor: CancellationActor,
  today = parisDateKey(),
): CancellationTerms => {
  const daysBeforeArrival = Math.floor((startOfDay(booking.startDate) - startOfDay(today)) / DAY_IN_MS);
  const total = Math.max(0, Number(booking.totalPrice) || 0);

  if (!['PENDING', 'APPROVED', 'CONFIRMED'].includes(booking.status)) {
    return {
      canCancel: false, daysBeforeArrival, refundPercent: 0, refundAmount: 0,
      label: 'Annulation indisponible', detail: 'Cette réservation ne peut plus être annulée.',
    };
  }

  // Haven steps in for exceptional cases (late owner cancellation, fraud, safety) until the arrival day.
  if (actor === 'HAVEN') {
    if (daysBeforeArrival < 0) return { canCancel: false, daysBeforeArrival, refundPercent: 0, refundAmount: 0, label: 'Annulation indisponible', detail: 'Le séjour a déjà commencé.' };
    const paid = booking.status === 'CONFIRMED' && booking.paymentStatus === 'PAID';
    return { canCancel: true, daysBeforeArrival, refundPercent: paid ? 100 : 0, refundAmount: paid ? total : 0,
      label: paid ? 'Remboursement intégral' : 'Annulation sans frais', detail: paid ? 'Une annulation par Haven rembourse intégralement le locataire.' : 'Aucun paiement n’a encore été encaissé.' };
  }

  // A reserved later stay of a recurring series is a commitment to the tenant, like a paid stay.
  const ownerCommitted = actor === 'OWNER' && (booking.status === 'CONFIRMED' || (booking.status === 'PENDING' && booking.seriesScheduled === true));
  if (ownerCommitted && daysBeforeArrival > 0 && daysBeforeArrival < OWNER_CANCELLATION_DAYS) {
    return {
      canCancel: false, daysBeforeArrival, refundPercent: 0, refundAmount: 0,
      label: 'Annulation par Haven uniquement',
      detail: `Moins de ${OWNER_CANCELLATION_DAYS} jours avant l’arrivée, un propriétaire ne peut plus annuler seul. Contactez Haven pour toute situation exceptionnelle.`,
    };
  }

  if (booking.status !== 'CONFIRMED') {
    return {
      canCancel: true, daysBeforeArrival, refundPercent: 0, refundAmount: 0,
      label: 'Annulation sans frais', detail: 'Aucun paiement n’a encore été encaissé.',
    };
  }

  if (daysBeforeArrival <= 0) {
    return {
      canCancel: false, daysBeforeArrival, refundPercent: 0, refundAmount: 0,
      label: 'Annulation indisponible', detail: 'Un séjour commencé ou arrivant aujourd’hui ne peut plus être annulé en ligne.',
    };
  }

  if (actor === 'OWNER') {
    return {
      canCancel: true, daysBeforeArrival, refundPercent: 100, refundAmount: total,
      label: 'Remboursement intégral', detail: `Possible jusqu’à ${OWNER_CANCELLATION_DAYS} jours avant l’arrivée. Le locataire est remboursé intégralement.`,
    };
  }

  if (daysBeforeArrival > TENANT_FULL_REFUND_AFTER_DAYS) {
    return {
      canCancel: true, daysBeforeArrival, refundPercent: 100, refundAmount: total,
      label: 'Remboursement intégral', detail: `Annulation plus de ${TENANT_FULL_REFUND_AFTER_DAYS} jours avant l’arrivée : hébergement, ménage et frais de service remboursés.`,
    };
  }

  if (daysBeforeArrival >= TENANT_HALF_REFUND_FROM_DAYS) {
    // Half of the stay and of the cleaning fee; Haven's service fee is kept.
    const serviceFee = Math.min(total, Math.max(0, Number(booking.platformFee) || 0));
    return {
      canCancel: true, daysBeforeArrival, refundPercent: 50, refundAmount: cents((total - serviceFee) * 0.5), serviceFeeKept: serviceFee,
      label: 'Remboursement à 50 %', detail: `Annulation de ${TENANT_FULL_REFUND_AFTER_DAYS} à ${TENANT_HALF_REFUND_FROM_DAYS} jours avant l’arrivée : 50 % de l’hébergement et du ménage remboursés, frais de service conservés.`,
    };
  }

  return {
    canCancel: true, daysBeforeArrival, refundPercent: 0, refundAmount: 0,
    label: 'Aucun remboursement', detail: `Annulation moins de ${TENANT_HALF_REFUND_FROM_DAYS} jours avant l’arrivée : aucun remboursement.`,
  };
};
