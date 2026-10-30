import type { OwnerPayout } from '../types';

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
