/**
 * Payments made on behalf of the owner (chantier 6). The owner is the merchant of the stay: Stripe pays the
 * whole amount into the owner's connected account at payment time and takes Haven's service fee back as an
 * application fee. Haven never keeps the rent; it controls only when the owner's balance is paid out to the bank
 * (manual payouts, the day after the arrival inventory), and can suspend that payout during a dispute.
 *
 * Older payments (policy v1) were collected by Haven and transferred after arrival: they keep that flow.
 */
export const CONNECT_ON_BEHALF_POLICY = 'haven-connect-onbehalf-v2';
export const isOnBehalfPolicy = (policy: unknown) => policy === CONNECT_ON_BEHALF_POLICY;

/** The owner's account can be the merchant: card payments active and charges enabled. */
export function canChargeOnBehalf(account: { charges_enabled?: boolean; capabilities?: { card_payments?: string } }) {
  return account.charges_enabled === true && account.capabilities?.card_payments === 'active';
}

/** Stripe parameters of a charge made on behalf of the owner. A deposit charge carries no Haven fee. */
export function onBehalfChargeData(accountId: string, applicationFeeCents: number) {
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) throw new Error('Compte Stripe du propriétaire invalide.');
  if (!Number.isSafeInteger(applicationFeeCents) || applicationFeeCents < 0) throw new Error('Frais de service invalides.');
  return { on_behalf_of: accountId, transfer_data: { destination: accountId }, ...(applicationFeeCents > 0 ? { application_fee_amount: applicationFeeCents } : {}) };
}

/**
 * Who bears a refund of a payment made on behalf of the owner:
 * - FULL: everything back to the tenant; the owner returns the stay and cleaning, Haven its fee
 *   (cancellation more than 14 days ahead, by the owner, or by Haven; payment that cannot be kept);
 * - OWNER_SHARE: the refund is taken from the owner's share and Haven keeps its fee (cancellation 14 to 8 days ahead);
 * - HAVEN_ONLY: a goodwill gesture decided by Haven, taken from its own balance.
 * With a destination charge the whole amount is transferred to the owner, so reversing the transfer in proportion
 * to the refund takes back exactly the refunded amount.
 */
export type RefundBearer = 'FULL' | 'OWNER_SHARE' | 'HAVEN_ONLY';
export function onBehalfRefundOptions(bearer: RefundBearer) {
  if (bearer === 'FULL') return { reverse_transfer: true, refund_application_fee: true };
  if (bearer === 'OWNER_SHARE') return { reverse_transfer: true, refund_application_fee: false };
  return { reverse_transfer: false, refund_application_fee: false };
}

/** Extra refund parameters: none for the older payments collected by Haven. */
export const refundOptionsFor = (policy: unknown, bearer: RefundBearer) => isOnBehalfPolicy(policy) ? onBehalfRefundOptions(bearer) : {};

/** Cancellation by the tenant, the owner or Haven: a full refund is FULL, a partial one is taken from the owner's share. */
export const cancellationRefundBearer = (refundPercent: number): RefundBearer => refundPercent >= 100 ? 'FULL' : 'OWNER_SHARE';

/** What the owner keeps from a payment made on their behalf: the transfer, minus reversals and Haven's remaining fee. */
export function ownerNetCents(transfer: { amount: number; amount_reversed: number }, fee?: { amount: number; amount_refunded: number } | null) {
  return Math.max(0, transfer.amount - transfer.amount_reversed - (fee ? fee.amount - fee.amount_refunded : 0));
}
