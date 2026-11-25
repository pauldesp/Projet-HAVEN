import type { Booking } from '../types';
import { monthBeforeArrival } from './recurringPaymentSchedule';
import { MAX_STAY_MESSAGE, MAX_STAY_NIGHTS, countNights, isBookableStay, localDateKey, longestContinuousNights } from './stay';

/** Days a failed or forgotten installment stays open before that stay alone is released. */
export const INSTALLMENT_GRACE_DAYS = 5;
export const INSTALLMENT_RETRY_HOURS = 48;
export const INSTALLMENT_REMINDER_DAYS = 3;
/** The first stay is paid by checkout; until then the other stays are only held for that window. */
export const SERIES_ACTIVATION_WINDOW_MS = 90 * 60 * 1000;
export const MAX_SERIES_STAYS = 24;

const DAY = 86400_000;
const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export type SeriesStayInput = { id: string; roomId: string; startDate: string; endDate: string };

/** First stay at booking; others one month before arrival, or at booking if that date has passed. */
export function installmentDueDates(stays: Pick<SeriesStayInput, 'startDate'>[], today: string): string[] {
  return stays.map((stay, index) => {
    const planned = monthBeforeArrival(stay.startDate);
    return index === 0 || planned <= today ? today : planned;
  });
}

export function validateSeriesStays(stays: SeriesStayInput[], now = new Date()): string | null {
  if (!Array.isArray(stays) || stays.length < 2) return 'Une série récurrente comporte au moins deux séjours.';
  if (stays.length > MAX_SERIES_STAYS) return `Une série récurrente comporte au plus ${MAX_SERIES_STAYS} séjours.`;
  const ids = new Set<string>();
  for (const stay of stays) {
    if (!stay || ![stay.id, stay.roomId].every(value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value))) return 'Un séjour de la série est invalide.';
    if (typeof stay.startDate !== 'string' || typeof stay.endDate !== 'string' || !isBookableStay(stay.startDate, stay.endDate, now) || countNights(stay.startDate, stay.endDate) < 1) return 'Les dates d’un séjour de la série sont invalides.';
    if (countNights(stay.startDate, stay.endDate) > MAX_STAY_NIGHTS) return MAX_STAY_MESSAGE;
    if (ids.has(stay.id)) return 'Un séjour de la série est en double.';
    ids.add(stay.id);
  }
  const sorted = [...stays].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (sorted.some((stay, index) => index > 0 && stay.startDate < sorted[index - 1].endDate)) return 'Les séjours de la série se chevauchent.';
  if (longestContinuousNights(sorted) > MAX_STAY_NIGHTS) return MAX_STAY_MESSAGE;
  return null;
}

export const isLaterSeriesStay = (booking: Pick<Booking, 'seriesId' | 'seriesIndex'>) => Boolean(booking.seriesId) && (booking.seriesIndex ?? 0) > 0;

/** End of the installment window: due date + 5 days, never after the arrival day. */
export function installmentDeadline(booking: Pick<Booking, 'installmentDueDate' | 'startDate'>): number {
  const due = booking.installmentDueDate || booking.startDate;
  const grace = Date.parse(`${addDays(due, INSTALLMENT_GRACE_DAYS)}T22:00:00Z`);
  const arrival = Date.parse(`${booking.startDate.slice(0, 10)}T06:00:00Z`);
  return Math.min(grace, arrival);
}

/** Deadline of an unpaid later stay, or undefined when the booking is not one. */
export function seriesStayDeadline(booking: Booking): number | undefined {
  if (!isLaterSeriesStay(booking) || booking.status !== 'PENDING' || booking.paymentStatus === 'PAID') return undefined;
  if (!booking.seriesActivatedAt) return Date.parse(booking.createdAt) + SERIES_ACTIVATION_WINDOW_MS;
  return installmentDeadline(booking);
}

export type InstallmentDecision = 'CHARGE' | 'WAIT' | 'SKIP';

export function installmentChargeDecision(booking: Booking, now = new Date()): InstallmentDecision {
  if (!isLaterSeriesStay(booking) || !booking.seriesActivatedAt || booking.status !== 'PENDING' || booking.paymentStatus === 'PAID') return 'SKIP';
  if (now.getTime() >= installmentDeadline(booking)) return 'SKIP';
  if (!booking.installmentDueDate || booking.installmentDueDate > localDateKey(now)) return 'WAIT';
  // The tenant may be paying by hand right now: never charge on top of an open checkout.
  if (booking.checkoutSessionId?.startsWith('cs_') && booking.checkoutExpiresAt && Date.parse(booking.checkoutExpiresAt) > now.getTime()) return 'WAIT';
  if (booking.installmentLeaseUntil && Date.parse(booking.installmentLeaseUntil) > now.getTime()) return 'WAIT';
  if (booking.nextInstallmentAttemptAt && Date.parse(booking.nextInstallmentAttemptAt) > now.getTime()) return 'WAIT';
  return 'CHARGE';
}

export const nextInstallmentAttempt = (now = new Date()) => new Date(now.getTime() + INSTALLMENT_RETRY_HOURS * 3600_000).toISOString();

/** Reminder 3 days before the charge, at 9:00 UTC; none when the charge is imminent. */
export function installmentReminderAt(dueDate: string, activatedAt: string): string | undefined {
  const at = Date.parse(`${addDays(dueDate, -INSTALLMENT_REMINDER_DAYS)}T09:00:00Z`);
  return at > Date.parse(activatedAt) + DAY / 2 ? new Date(at).toISOString() : undefined;
}

export type InstallmentState = 'NONE' | 'AWAITING_FIRST' | 'SCHEDULED' | 'DUE' | 'FAILED';

/** How a later stay of a series stands for the tenant, for display. */
export function installmentState(booking: Booking, now = new Date()): InstallmentState {
  if (!isLaterSeriesStay(booking) || booking.status !== 'PENDING' || booking.paymentStatus === 'PAID') return 'NONE';
  if (!booking.seriesActivatedAt) return 'AWAITING_FIRST';
  if ((booking.installmentAttempts || 0) > 0) return 'FAILED';
  return booking.installmentDueDate && booking.installmentDueDate > localDateKey(now) ? 'SCHEDULED' : 'DUE';
}

export const installmentDateLabel = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const installmentDeadlineLabel = (booking: Pick<Booking, 'installmentDueDate' | 'startDate'>) =>
  new Date(installmentDeadline(booking)).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

/** Explicit authorization for the automatic charges of a series, stored with the series as proof. */
export const AUTO_CHARGE_CONSENT_VERSION = 'haven-auto-charge-v1';
export const AUTO_CHARGE_CONSENT_TEXT = 'J’autorise Haven à enregistrer ma carte via Stripe et à prélever automatiquement chaque séjour suivant de cette série, au montant indiqué, un mois avant son arrivée (ou dès la réservation si l’arrivée est plus proche). Je peux payer un séjour à l’avance ou l’annuler selon les conditions d’annulation.';
