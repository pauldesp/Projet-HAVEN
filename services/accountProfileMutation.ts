import { isValidPastBirthDate, personalDetailsUpdate } from './profileVerification';
import { isValidPhoneForVerification } from './phoneVerification';

type SavedProfile = {
  firstName?: unknown;
  lastName?: unknown;
  birthDate?: unknown;
  phone?: unknown;
  identityVerified?: unknown;
  phoneVerified?: unknown;
  verificationSubmittedAt?: string | null;
};

export type PersonalDetailsInput = { firstName: string; lastName: string; birthDate: string; phone: string };

export function preparePhoneForVerification(profile: SavedProfile, phone: unknown) {
  if (typeof phone !== 'string' || !isValidPhoneForVerification(phone)) {
    throw new Error('Saisissez un numéro de téléphone valide avec son indicatif.');
  }
  if (profile.phone === phone) return null;
  if (profile.phoneVerified === true) {
    throw new Error('Un numéro déjà confirmé ne peut pas être remplacé ici.');
  }
  return { phone, phoneVerified: false, phoneVerifiedAt: null, isVerified: false, verificationSubmittedAt: null };
}

export function preparePersonalDetails(profile: SavedProfile, details: PersonalDetailsInput) {
  const firstName = typeof details.firstName === 'string' ? details.firstName.trim() : '';
  const lastName = typeof details.lastName === 'string' ? details.lastName.trim() : '';
  const { birthDate, phone } = details;
  if (!firstName || firstName.length >= 100 || !lastName || lastName.length >= 100 || !isValidPastBirthDate(birthDate)) {
    throw new Error('Prénom, nom ou date de naissance invalide.');
  }
  if (!isValidPhoneForVerification(phone)) {
    throw new Error('Saisissez un numéro de téléphone valide avec son indicatif.');
  }
  const identityChanged = profile.firstName !== firstName || profile.lastName !== lastName || profile.birthDate !== birthDate;
  const phoneChanged = profile.phone !== phone;
  if (identityChanged && profile.identityVerified === true) {
    throw new Error('Votre identité est déjà confirmée. Contactez l’assistance pour modifier ces informations.');
  }
  if (phoneChanged && profile.phoneVerified === true) {
    throw new Error('Votre téléphone est déjà confirmé. Contactez l’assistance pour le modifier.');
  }
  if (!identityChanged && !phoneChanged) return null;
  return {
    ...personalDetailsUpdate(profile as PersonalDetailsInput & { verificationSubmittedAt?: string | null }, { firstName, lastName, birthDate, phone }),
    ...(phoneChanged ? { phoneVerified: false, phoneVerifiedAt: null, isVerified: false } : {})
  };
}
