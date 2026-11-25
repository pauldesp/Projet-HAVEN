import { createHash, randomBytes } from 'node:crypto';
import type { Booking } from '../types';

/**
 * Stay space of an occupant without an account (booking made for someone else). Access is a personal link:
 * a random token sent by e-mail, stored only as a hash in the server collection `occupant_access`.
 * It opens one stay, until 7 days after departure.
 */
export const OCCUPANT_ACCESS_DAYS_AFTER_DEPARTURE = 7;
export const OCCUPANT_LINK_RESEND_MINUTES = 10;

export type OccupantAccess = { bookingId: string; tenantId: string; createdAt: string; expiresAt: string };

export const createOccupantToken = () => randomBytes(32).toString('base64url');
export const hashOccupantToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const isWellFormedOccupantToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

export function occupantAccessExpiry(endDate: string) {
  return new Date(Date.parse(`${endDate.slice(0, 10)}T23:59:59Z`) + OCCUPANT_ACCESS_DAYS_AFTER_DEPARTURE * 86400_000).toISOString();
}

export function occupantAccessRecord(booking: Pick<Booking, 'id' | 'tenantId' | 'endDate'>, createdAt: string): OccupantAccess {
  return { bookingId: booking.id, tenantId: booking.tenantId, createdAt, expiresAt: occupantAccessExpiry(booking.endDate) };
}

/** Why a link does not open (null when it does). */
export function occupantAccessProblem(access: OccupantAccess | undefined, booking: Booking | undefined, now = Date.now()): string | null {
  if (!access || !booking || access.bookingId !== booking.id || !booking.occupant) return 'Ce lien n’est pas valide. Demandez à la personne qui a réservé de vous renvoyer votre lien.';
  if (now > Date.parse(access.expiresAt)) return 'Ce lien a expiré : le séjour est terminé depuis plus de 7 jours.';
  if (booking.status === 'CANCELLED') return 'Ce séjour a été annulé. Contactez la personne qui a réservé.';
  if (booking.paymentStatus !== 'PAID' || !['CONFIRMED', 'COMPLETED'].includes(booking.status)) return 'Ce séjour n’est pas encore confirmé.';
  return null;
}

/** Path of the stay space in the application (hash routing: the token never reaches server logs). */
export const occupantStayRoute = (token: string) => `/sejour/${token}`;
