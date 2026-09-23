import type { Booking } from '../types';

export type CancellationActor = 'TENANT' | 'OWNER';

export interface CancellationTerms {
  canCancel: boolean;
  daysBeforeArrival: number;
  refundPercent: number;
  refundAmount: number;
  label: string;
  detail: string;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const startOfDay = (value: string) => new Date(`${value}T00:00:00`).getTime();

/**
 * HAVEN's first cancellation policy. Keeping this logic isolated makes the
 * commercial thresholds easy to change without altering the booking flow.
 */
export const getCancellationTerms = (
  booking: Pick<Booking, 'status' | 'startDate' | 'totalPrice' | 'paymentStatus'>,
  actor: CancellationActor,
  today = new Date().toISOString().slice(0, 10),
): CancellationTerms => {
  const daysBeforeArrival = Math.floor((startOfDay(booking.startDate) - startOfDay(today)) / DAY_IN_MS);
  const total = Math.max(0, Number(booking.totalPrice) || 0);

  if (!['PENDING', 'APPROVED', 'CONFIRMED'].includes(booking.status)) {
    return {
      canCancel: false, daysBeforeArrival, refundPercent: 0, refundAmount: 0,
      label: 'Annulation indisponible', detail: 'Cette réservation ne peut plus être annulée.',
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
      label: 'Remboursement intégral', detail: 'Le locataire est remboursé intégralement lorsqu’un propriétaire annule.',
    };
  }

  if (daysBeforeArrival >= 30) {
    return {
      canCancel: true, daysBeforeArrival, refundPercent: 100, refundAmount: total,
      label: 'Remboursement intégral', detail: 'Annulation au moins 30 jours avant l’arrivée.',
    };
  }

  if (daysBeforeArrival >= 14) {
    return {
      canCancel: true, daysBeforeArrival, refundPercent: 50, refundAmount: Math.round(total * 0.5),
      label: 'Remboursement à 50 %', detail: 'Annulation entre 14 et 29 jours avant l’arrivée.',
    };
  }

  return {
    canCancel: true, daysBeforeArrival, refundPercent: 0, refundAmount: 0,
    label: 'Aucun remboursement', detail: 'Annulation moins de 14 jours avant l’arrivée.',
  };
};
