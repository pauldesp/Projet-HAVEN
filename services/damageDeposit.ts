import type { Booking, DamageClaim } from '../types';
import { formatEuros } from './money';
import { parisDateKey } from './stay';

/**
 * Caution Haven : rien n'est bloqué ni débité à la réservation. La carte du locataire est enregistrée par Stripe ;
 * après le départ, le propriétaire a 7 jours pour déclarer une dégradation. Haven examine le dossier (avec la réponse
 * du locataire) et peut alors prélever au plus le plafond, reversé au propriétaire.
 */
export const DAMAGE_DEPOSIT_POLICY = { amountCents: 30_000, claimWindowDays: 7, version: 'haven-deposit-v1' } as const;
/** The tenant is told by e-mail and has this long to answer before Haven may charge. */
export const DAMAGE_RESPONSE_DAYS = 3;
export const damageResponseDeadline = (claim: Pick<DamageClaim, 'createdAt'>) => new Date(Date.parse(claim.createdAt) + DAMAGE_RESPONSE_DAYS * 86400_000).toISOString();
/** Charging waits for the tenant's answer or the end of the response period; refusing never has to wait. */
export const canChargeDamageClaim = (claim: Pick<DamageClaim, 'createdAt' | 'tenantResponse'>, now = Date.now()) =>
  Boolean(claim.tenantResponse) || now >= Date.parse(damageResponseDeadline(claim));

export const DAMAGE_DEPOSIT_CONSENT_TEXT =
  `J’autorise Haven à conserver ma carte via Stripe et à la prélever de ${formatEuros(DAMAGE_DEPOSIT_POLICY.amountCents / 100)} au plus si le propriétaire déclare une dégradation dans les ${DAMAGE_DEPOSIT_POLICY.claimWindowDays} jours suivant mon départ et que Haven la valide après examen des états des lieux et de ma réponse. Rien n’est bloqué ni débité à la réservation.`;

export const DAMAGE_DESCRIPTION_MIN = 20;
export const DAMAGE_DESCRIPTION_MAX = 2000;
export const DAMAGE_RESPONSE_MAX = 2000;
export const DAMAGE_MAX_PHOTOS = 6;
const MAX_PHOTO_LENGTH = 120_000; // An optimized photo is about 45 KiB, i.e. 60 000 base64 characters.

export class DamageClaimError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}

export function assertDamageDepositAccepted(version: unknown) {
  if (version !== DAMAGE_DEPOSIT_POLICY.version) throw new DamageClaimError('Acceptez la caution avant de continuer.');
}

const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T12:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);

/** Last day (inclusive) on which the owner can declare damage: departure day + 7. */
export const damageClaimDeadline = (booking: Pick<Booking, 'endDate'>) => addDays(booking.endDate, DAMAGE_DEPOSIT_POLICY.claimWindowDays);

/** The stay is paid, has ended (departure day included) and the 7-day window is still open. */
export function canDeclareDamage(booking: Booking, today = parisDateKey()) {
  if (booking.paymentStatus !== 'PAID' || !['CONFIRMED', 'COMPLETED'].includes(booking.status)) return false;
  if (!booking.depositConsent) return false;
  return today >= booking.endDate && today <= damageClaimDeadline(booking);
}

export function parseEuroCents(value: unknown) {
  const cents = typeof value === 'number' ? Math.round(value) : NaN;
  return Number.isSafeInteger(cents) ? cents : NaN;
}

/** Validates what the owner sends; returns the clean fields to store. */
export function validateDamageClaimInput(body: { amountCents?: unknown; description?: unknown; photos?: unknown }) {
  const amountCents = parseEuroCents(body.amountCents);
  if (!(amountCents >= 100 && amountCents <= DAMAGE_DEPOSIT_POLICY.amountCents)) {
    throw new DamageClaimError(`Indiquez un montant entre 1 € et ${formatEuros(DAMAGE_DEPOSIT_POLICY.amountCents / 100)}.`);
  }
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length < DAMAGE_DESCRIPTION_MIN || description.length > DAMAGE_DESCRIPTION_MAX) {
    throw new DamageClaimError(`Décrivez la dégradation et son coût (${DAMAGE_DESCRIPTION_MIN} caractères au moins).`);
  }
  const photos = Array.isArray(body.photos) ? body.photos : [];
  if (photos.length < 1 || photos.length > DAMAGE_MAX_PHOTOS) throw new DamageClaimError(`Ajoutez entre 1 et ${DAMAGE_MAX_PHOTOS} photos (dégradation, devis ou facture).`);
  if (photos.some(photo => typeof photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo) || photo.length > MAX_PHOTO_LENGTH)) {
    throw new DamageClaimError('Une des photos n’est pas valide. Ajoutez-la de nouveau.');
  }
  return { amountCents, description, photos: photos as string[] };
}

export function validateDamageResponse(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < 5 || text.length > DAMAGE_RESPONSE_MAX) throw new DamageClaimError('Écrivez votre réponse (5 caractères au moins).');
  return text;
}

/** Amount Haven may charge: what the owner asked for, never more than the deposit ceiling. */
export function validateDamageDecision(claim: Pick<DamageClaim, 'status' | 'requestedCents' | 'createdAt' | 'tenantResponse'>, body: { decision?: unknown; amountCents?: unknown; note?: unknown }, now = Date.now()) {
  if (claim.status !== 'SUBMITTED') throw new DamageClaimError('Cette déclaration a déjà été traitée.', 409);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
  if (note.length < 3) throw new DamageClaimError('Expliquez la décision (elle est montrée au propriétaire et au locataire).');
  if (body.decision === 'REJECT') return { decision: 'REJECT' as const, amountCents: 0, note };
  if (body.decision !== 'APPROVE') throw new DamageClaimError('Décision inconnue.');
  if (!canChargeDamageClaim(claim, now)) {
    const until = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(damageResponseDeadline(claim)));
    throw new DamageClaimError(`Le locataire peut répondre jusqu’au ${until}. Attendez sa réponse ou la fin de ce délai avant de prélever (un refus reste possible à tout moment).`, 409);
  }
  const amountCents = parseEuroCents(body.amountCents);
  if (!(amountCents >= 100 && amountCents <= Math.min(claim.requestedCents, DAMAGE_DEPOSIT_POLICY.amountCents))) {
    throw new DamageClaimError(`Le montant retenu doit être compris entre 1 € et ${formatEuros(Math.min(claim.requestedCents, DAMAGE_DEPOSIT_POLICY.amountCents) / 100)}.`);
  }
  return { decision: 'APPROVE' as const, amountCents, note };
}

export const DAMAGE_STATUS_LABELS: Record<DamageClaim['status'], string> = {
  SUBMITTED: 'En cours d’examen par Haven',
  REJECTED: 'Refusée par Haven',
  CHARGING: 'Prélèvement en cours',
  CHARGED: 'Prélevée par Haven pour le propriétaire',
  CHARGE_FAILED: 'Prélèvement refusé par la banque',
};
