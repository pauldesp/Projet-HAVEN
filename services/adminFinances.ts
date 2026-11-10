import type { Booking } from '../types';

/** Already refunded by Haven on a paid booking, in cents. */
export const havenRefundedCents = (booking: Pick<Booking, 'havenRefunds'>) => (booking.havenRefunds || []).reduce((sum, item) => sum + item.amountCents, 0);

/** Most Haven can refund without cancelling, and the part it can take from its own commission. */
export function goodwillLimits(booking: Pick<Booking, 'totalPrice' | 'platformFee' | 'havenRefunds'>) {
  const already = havenRefundedCents(booking);
  return { maxCents: Math.max(0, Math.round(booking.totalPrice * 100) - already), fromCommissionCents: Math.max(0, Math.round(booking.platformFee * 100) - already) };
}
