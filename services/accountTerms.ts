import type { LegalDocument } from '../types';

export function selectAccountTerms(documents: LegalDocument[]): LegalDocument | null {
  return ['conditions-generales', 'cgu', 'terms'].map(id => documents.find(document => document.id === id))
    .find(document => typeof document?.content === 'string' && document.content.trim() && document.lastUpdated) || null;
}

export function assertAccountTermsConsent(consent: unknown, version: unknown, document: LegalDocument | null) {
  if (!document) throw new Error('Les conditions générales sont indisponibles. Réessayez plus tard.');
  if (consent !== true) throw new Error('Acceptez les conditions générales pour transmettre votre dossier.');
  if (version !== document.lastUpdated) throw new Error('Les conditions générales ont changé. Rechargez-les avant de les accepter.');
}

export function registrationPasswordError(password: string, confirmation: string): string | null {
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.';
  }
  if (password !== confirmation) return 'Les deux mots de passe ne correspondent pas.';
  return null;
}
