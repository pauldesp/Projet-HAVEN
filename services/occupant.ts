import { ageOn, isValidPastBirthDate } from './profileVerification';
import { isValidPhoneForVerification, normalizePhoneForVerification } from './phoneVerification';
import { validResidenceDocument } from './residence';

/**
 * Booking for someone else (conditions de réservation): the account that books (the Réservant) pays and remains
 * responsible; the occupant stays. The occupant is at least 16 on arrival; under 18, the Réservant declares being
 * their legal representative and provides a parental authorization (PDF or photo, like the other documents).
 */
export const MINIMUM_OCCUPANT_AGE = 16;
export const ADULT_AGE = 18;

export const GUARDIAN_DECLARATION_VERSION = 'haven-guardian-2026-11-25';
export const GUARDIAN_DECLARATION_TEXT = 'Je déclare être le représentant légal de l’occupant mineur et l’autoriser à séjourner dans ce logement aux dates réservées. Je reste responsable de la réservation et du séjour.';

export type Occupant = { firstName: string; lastName: string; birthDate: string; email: string; phone: string; minor: boolean; parentalAuthorization?: boolean };
export type GuardianDeclaration = { version: string; text: string; declaredAt: string };

export class OccupantError extends Error {
  status = 422;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanName = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

/**
 * Validates the occupant entered by the Réservant. `firstArrival` is the arrival of the (first) stay: the occupant's
 * age is checked on that day. Returns the occupant to store, without the document itself.
 */
export function normalizeOccupant(input: unknown, firstArrival: string, options: { guardianDeclarationVersion?: unknown; parentalAuthorization?: unknown; bookerEmail?: string } = {}): Occupant {
  const data = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const firstName = cleanName(data.firstName);
  const lastName = cleanName(data.lastName);
  if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100) throw new OccupantError('Indiquez le prénom et le nom de l’occupant.');
  if (!isValidPastBirthDate(data.birthDate)) throw new OccupantError('Indiquez une date de naissance valide pour l’occupant.');
  const birthDate = data.birthDate as string;
  const age = ageOn(birthDate, firstArrival);
  if (age < MINIMUM_OCCUPANT_AGE) throw new OccupantError(`L’occupant doit avoir au moins ${MINIMUM_OCCUPANT_AGE} ans le jour de l’arrivée.`);
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email) || email.length > 200) throw new OccupantError('Indiquez une adresse e-mail valide pour l’occupant.');
  if (options.bookerEmail && email === options.bookerEmail.trim().toLowerCase()) throw new OccupantError('Indiquez l’adresse e-mail de l’occupant, différente de la vôtre.');
  const phone = normalizePhoneForVerification(typeof data.phone === 'string' ? data.phone : '');
  if (!isValidPhoneForVerification(phone)) throw new OccupantError('Indiquez le téléphone de l’occupant avec son indicatif, par exemple +33 6 12 34 56 78.');
  const minor = age < ADULT_AGE;
  if (minor) {
    if (options.guardianDeclarationVersion !== GUARDIAN_DECLARATION_VERSION) throw new OccupantError('L’occupant est mineur : déclarez être son représentant légal.');
    if (!validResidenceDocument(options.parentalAuthorization)) throw new OccupantError('L’occupant est mineur : joignez l’autorisation parentale (PDF, JPG ou PNG).');
  }
  return { firstName, lastName, birthDate, email, phone, minor, ...(minor ? { parentalAuthorization: true } : {}) };
}

export const guardianDeclarationRecord = (declaredAt: string): GuardianDeclaration =>
  ({ version: GUARDIAN_DECLARATION_VERSION, text: GUARDIAN_DECLARATION_TEXT, declaredAt });

export const occupantFullName = (occupant: Pick<Occupant, 'firstName' | 'lastName'>) => `${occupant.firstName} ${occupant.lastName}`;
