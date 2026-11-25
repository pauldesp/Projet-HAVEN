/**
 * Main residence declaration (conditions de réservation): a Haven room is never the tenant's main home.
 * Required at every booking, single or recurring; the exact text, its version and the time are kept with
 * the booking as proof, like the automatic charge consent.
 */
export const RESIDENCE_DECLARATION_VERSION = 'haven-residence-2026-11-25';
export const RESIDENCE_DECLARATION_TEXT = 'Je déclare disposer d’une résidence principale distincte de cette chambre et ne pas y domicilier mon courrier, une entreprise ou une démarche administrative.';

export type ResidenceDeclaration = { version: string; text: string; declaredAt: string };

export class ResidenceDeclarationError extends Error {
  status = 422;
}

export function assertResidenceDeclared(version: unknown) {
  if (version !== RESIDENCE_DECLARATION_VERSION) throw new ResidenceDeclarationError('Cochez la déclaration de résidence principale pour réserver.');
}

export const residenceDeclarationRecord = (declaredAt: string): ResidenceDeclaration =>
  ({ version: RESIDENCE_DECLARATION_VERSION, text: RESIDENCE_DECLARATION_TEXT, declaredAt });
