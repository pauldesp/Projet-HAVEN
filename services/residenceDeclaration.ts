/**
 * Main residence declaration (conditions de réservation): a Haven room is never the tenant's main home.
 * Required at every booking, single or recurring; the exact text, its version and the time are kept with
 * the booking as proof, like the automatic charge consent.
 */
export const RESIDENCE_DECLARATION_VERSION = 'haven-residence-2026-11-25';
export const RESIDENCE_DECLARATION_TEXT = 'Je déclare disposer d’une résidence principale distincte de cette chambre et ne pas y domicilier mon courrier, une entreprise ou une démarche administrative.';

/** Same declaration, worded for the occupant when the account that books does not stay itself. */
export const OCCUPANT_RESIDENCE_DECLARATION_VERSION = 'haven-residence-occupant-2026-11-25';
export const OCCUPANT_RESIDENCE_DECLARATION_TEXT = 'Je déclare que l’occupant dispose d’une résidence principale distincte de cette chambre et n’y domiciliera pas son courrier, une entreprise ou une démarche administrative.';

export const residenceDeclarationText = (forSomeoneElse = false) => forSomeoneElse ? OCCUPANT_RESIDENCE_DECLARATION_TEXT : RESIDENCE_DECLARATION_TEXT;
export const residenceDeclarationVersion = (forSomeoneElse = false) => forSomeoneElse ? OCCUPANT_RESIDENCE_DECLARATION_VERSION : RESIDENCE_DECLARATION_VERSION;

export type ResidenceDeclaration = { version: string; text: string; declaredAt: string };

export class ResidenceDeclarationError extends Error {
  status = 422;
}

export function assertResidenceDeclared(version: unknown, forSomeoneElse = false) {
  if (version !== residenceDeclarationVersion(forSomeoneElse)) throw new ResidenceDeclarationError('Cochez la déclaration de résidence principale pour réserver.');
}

export const residenceDeclarationRecord = (declaredAt: string, forSomeoneElse = false): ResidenceDeclaration =>
  ({ version: residenceDeclarationVersion(forSomeoneElse), text: residenceDeclarationText(forSomeoneElse), declaredAt });
