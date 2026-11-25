import { isValidPastBirthDate } from './profileVerification';

/**
 * Owner status and tax details (chantier 7). Private: kept in the server collection `owner_tax_profiles`,
 * readable by the owner and Haven only, like identity documents. Payouts wait until the DAC7 details are complete
 * (Directive 2021/514: platforms report their sellers' income to the tax authority).
 *
 * - Private host (particulier): tax number (NIF), birth date, address.
 * - Professional host, sole trader: SIRET, plus the same personal details.
 * - Professional host, company: SIRET of the establishment (its SIREN is the first 9 digits), company name, address.
 */
export type HostStatus = 'PARTICULIER' | 'PROFESSIONNEL';
export type LegalForm = 'INDIVIDUEL' | 'SOCIETE';
export type TaxAddress = { street: string; postalCode: string; city: string; country: string };
export type OwnerTaxProfile = {
  status: HostStatus;
  legalForm?: LegalForm;
  siret?: string;
  siren?: string;
  companyName?: string;
  nif?: string;
  nifCountry?: string;
  birthDate?: string;
  address: TaxAddress;
  updatedAt: string;
};

export class TaxProfileError extends Error { status = 422; }

const digits = (value: unknown) => typeof value === 'string' ? value.replace(/[\s.-]/g, '') : '';
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';

/** Luhn checksum, used by SIREN and SIRET (La Poste establishments excepted). */
function luhn(number: string) {
  let sum = 0;
  for (let index = 0; index < number.length; index++) {
    let digit = Number(number[number.length - 1 - index]);
    if (index % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return sum % 10 === 0;
}
export function isValidSiren(value: string) { return /^\d{9}$/.test(value) && luhn(value); }
export function isValidSiret(value: string) {
  if (!/^\d{14}$/.test(value)) return false;
  // La Poste's establishments use another rule: the digits add up to a multiple of 5.
  if (value.startsWith('356000000')) return [...value].reduce((sum, digit) => sum + Number(digit), 0) % 5 === 0;
  return luhn(value) && isValidSiren(value.slice(0, 9));
}
/** French tax number: 13 digits starting with 0 to 3. Another country's number: 5 to 20 letters or digits. */
export function isValidNif(value: string, country: string) {
  return country === 'FR' ? /^[0-3]\d{12}$/.test(value) : /^[A-Z0-9]{5,20}$/.test(value);
}

export function normalizeTaxProfile(input: unknown, now = new Date().toISOString()): OwnerTaxProfile {
  const data = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const status = data.status === 'PROFESSIONNEL' ? 'PROFESSIONNEL' : data.status === 'PARTICULIER' ? 'PARTICULIER' : null;
  if (!status) throw new TaxProfileError('Indiquez si vous louez en tant que particulier ou professionnel.');
  const raw = data.address && typeof data.address === 'object' ? data.address as Record<string, unknown> : {};
  const address = { street: text(raw.street, 200), postalCode: text(raw.postalCode, 20), city: text(raw.city, 100), country: text(raw.country, 2).toUpperCase() || 'FR' };
  if (!address.street || !address.postalCode || !address.city || !/^[A-Z]{2}$/.test(address.country)) throw new TaxProfileError('Indiquez votre adresse complète (rue, code postal, ville, pays).');
  const legalForm: LegalForm | undefined = status === 'PROFESSIONNEL' ? (data.legalForm === 'SOCIETE' ? 'SOCIETE' : data.legalForm === 'INDIVIDUEL' ? 'INDIVIDUEL' : undefined) : undefined;
  if (status === 'PROFESSIONNEL' && !legalForm) throw new TaxProfileError('Indiquez si vous exercez en entreprise individuelle ou en société.');
  const profile: OwnerTaxProfile = { status, address, updatedAt: now, ...(legalForm ? { legalForm } : {}) };
  if (status === 'PROFESSIONNEL') {
    const siret = digits(data.siret);
    if (!isValidSiret(siret)) throw new TaxProfileError('Le numéro SIRET doit comporter 14 chiffres valides.');
    Object.assign(profile, { siret, siren: siret.slice(0, 9) });
  }
  if (legalForm === 'SOCIETE') {
    const companyName = text(data.companyName, 200);
    if (!companyName) throw new TaxProfileError('Indiquez la dénomination de la société.');
    profile.companyName = companyName;
  } else {
    // A person (private host or sole trader): tax number and birth date.
    const nifCountry = text(data.nifCountry, 2).toUpperCase() || 'FR';
    const nif = digits(data.nif).toUpperCase();
    if (!isValidNif(nif, nifCountry)) throw new TaxProfileError(nifCountry === 'FR' ? 'Le numéro fiscal (NIF) comporte 13 chiffres et commence par 0, 1, 2 ou 3. Il figure sur votre avis d’impôt.' : 'Indiquez un numéro d’identification fiscale valide.');
    if (!isValidPastBirthDate(data.birthDate)) throw new TaxProfileError('Indiquez votre date de naissance.');
    Object.assign(profile, { nif, nifCountry, birthDate: data.birthDate as string });
  }
  return profile;
}

/** DAC7 details complete: payouts can go ahead. */
export function isTaxProfileComplete(profile: unknown): boolean {
  try { normalizeTaxProfile(profile, (profile as OwnerTaxProfile)?.updatedAt); return true; } catch { return false; }
}

export const TAX_PROFILE_MISSING_MESSAGE = 'Complétez votre statut et vos informations fiscales dans l’onglet Finances : la loi impose à Haven de les collecter avant tout versement.';

/** What the owner sees back: the tax number is masked. */
export function maskedTaxProfile(profile: OwnerTaxProfile) {
  return { ...profile, ...(profile.nif ? { nif: `•••••••••${profile.nif.slice(-4)}` } : {}) };
}

export const hostStatusLabel = (status: HostStatus | null | undefined) => status === 'PROFESSIONNEL' ? 'Hôte professionnel' : status === 'PARTICULIER' ? 'Hôte particulier' : null;
