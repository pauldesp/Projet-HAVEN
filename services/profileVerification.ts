export function isValidPastBirthDate(value: unknown, today = new Date().toISOString().slice(0, 10)): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value < today;
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
    typeof profile.phone === 'string' && /^\+[1-9]\d{7,14}$/.test(profile.phone)
  );
}

type VerificationProfile = Parameters<typeof hasCompleteVerificationDetails>[0] & {
  emailVerified?: unknown;
  phoneVerified?: unknown;
  documents?: { idCard?: unknown } | null;
  verificationSubmittedAt?: unknown;
  identityVerified?: unknown;
  status?: unknown;
  legalAccepted?: unknown;
};

export function isVerificationReadyToSubmit(profile: VerificationProfile): boolean {
  return hasCompleteVerificationDetails(profile) &&
    profile.emailVerified === true &&
    profile.phoneVerified === true &&
    typeof profile.documents?.idCard === 'string' &&
    profile.documents.idCard.length > 0;
}

export function isVerificationReadyForAdminReview(profile: VerificationProfile): boolean {
  return isVerificationReadyToSubmit(profile) &&
    profile.legalAccepted === true &&
    typeof profile.verificationSubmittedAt === 'string' &&
    profile.verificationSubmittedAt.length > 0;
}

export function isAccountVerificationComplete(profile: VerificationProfile): boolean {
  return profile.status === 'APPROVED' &&
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
