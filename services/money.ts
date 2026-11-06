import type { Booking } from '../types';
import { ownerShareCents } from './stripeConnect';

const EURO = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** French euro amount with two decimals, e.g. « 116,00 € ». */
export function formatEuros(amount: number): string {
  return Number.isFinite(amount) ? EURO.format(amount) : '—';
}

/** What the owner receives for a stay (rent + cleaning, Haven fees excluded), or null if the stored amounts disagree. */
export function ownerShare(booking: Pick<Booking, 'basePrice' | 'cleaningFee' | 'platformFee' | 'totalPrice'>): number | null {
  try { return ownerShareCents(booking) / 100; } catch { return null; }
}
