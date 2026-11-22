import { parisDateKey } from './stay';
import { hasRequiredResidence } from './residence';
import { hasVerificationException } from './verificationException';
export function isValidPastBirthDate(value: unknown, today = parisDateKey()): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value < today;
}

export function hasRequiredPhoneNumber(profile: { phone?: unknown }): boolean {
  return typeof profile.phone === 'string' && /^\+[1-9]\d{7,14}$/.test(profile.phone);
}

export function hasCompleteVerificationDetails(profile: {
  firstName?: unknown;
  lastName?: unknown;
  birthDate?: unknown;
  phone?: unknown;
}): boolean {
  return Boolean(
    typeof profile.firstName === 'string' && profile.firstName.trim() &&
    typeof profile.lastName === 'string' && profile.lastName.trim() &&
    isValidPastBirthDate(profile.birthDate) &&
    hasRequiredPhoneNumber(profile)
  );
}

type VerificationProfile = Parameters<typeof hasCompleteVerificationDetails>[0] & {
  emailVerified?: unknown;
  phoneVerified?: unknown;
  documents?: { idCard?: unknown; idCardBack?: unknown; idDocumentType?: unknown; proofOfAddress?: unknown } | null;
  residenceProvided?: unknown;
  verificationSubmittedAt?: unknown;
  identityVerified?: unknown;
  status?: unknown;
  legalAccepted?: unknown;
  verificationException?: unknown;
};

/** Identity cards and residence permits have two sides; a passport only its photo page. */
export const TWO_SIDED_IDENTITY_DOCUMENTS = ['ID_CARD', 'RESIDENCE_PERMIT'] as const;
export const isTwoSidedIdentityDocument = (type: unknown) => (TWO_SIDED_IDENTITY_DOCUMENTS as readonly unknown[]).includes(type);

/** Front present, and the back too for a two-sided document. Older accounts (no type recorded) keep their single file. */
export function hasCompleteIdentityDocument(documents: VerificationProfile['documents']): boolean {
  if (typeof documents?.idCard !== 'string' || documents.idCard.length === 0) return false;
  return !isTwoSidedIdentityDocument(documents.idDocumentType) || documents.idCardBack === 'STORED';
}

export function isVerificationReadyToSubmit(profile: VerificationProfile): boolean {
  return hasCompleteVerificationDetails(profile) &&
    profile.emailVerified === true &&
    hasCompleteIdentityDocument(profile.documents);
}

export function isVerificationReadyForAdminReview(profile: VerificationProfile): boolean {
  return isVerificationReadyToSubmit(profile) && hasRequiredResidence(profile) &&
    profile.legalAccepted === true &&
    typeof profile.verificationSubmittedAt === 'string' &&
    profile.verificationSubmittedAt.length > 0;
}

export function isVerificationPending(profile: VerificationProfile): boolean {
  return profile.status === 'PENDING' && isVerificationReadyForAdminReview(profile);
}

export function isAccountVerificationComplete(profile: VerificationProfile): boolean {
  return hasVerificationException(profile) || profile.status === 'APPROVED' &&
    profile.legalAccepted === true &&
    profile.identityVerified === true &&
    isVerificationReadyToSubmit(profile);
}

type PersonalDetails = { firstName: string; lastName: string; birthDate: string; phone: string };

export function personalDetailsUpdate(previous: PersonalDetails & { verificationSubmittedAt?: string | null }, details: PersonalDetails): PersonalDetails & { verificationSubmittedAt?: null } {
  const changed = (Object.keys(details) as Array<keyof PersonalDetails>).some(key => previous[key] !== details[key]);
  return {
    ...details,
    ...(changed && previous.verificationSubmittedAt ? { verificationSubmittedAt: null } : {})
  };
}
