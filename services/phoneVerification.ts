export function normalizePhoneForVerification(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, '');
  if (compact.startsWith('+')) return compact;
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;
  if (compact.startsWith('0')) return `+33${compact.slice(1)}`;
  return `+${compact}`;
}

export function isValidPhoneForVerification(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

// Firebase throws auth/internal-error when clear() is called twice. Detach
// the instance before destroying it so navigation cleanup remains idempotent.
export function clearPhoneRecaptcha(ref: { current: { clear(): void } | null }): void {
  const verifier = ref.current;
  ref.current = null;
  verifier?.clear();
}

export async function finishPhoneVerification(actions: {
  confirmCode: () => Promise<unknown>;
  refreshToken: () => Promise<unknown>;
  syncProfile: () => Promise<unknown>;
  refreshProfile: () => Promise<unknown>;
}): Promise<void> {
  await actions.confirmCode();
  await actions.refreshToken();
  await actions.syncProfile();
  await actions.refreshProfile();
}

export function phoneVerificationErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'L’envoi de SMS n’est pas encore activé pour HAVEN. Contactez l’assistance.';
    case 'auth/unauthorized-domain':
    case 'auth/captcha-check-failed':
    case 'auth/invalid-app-credential':
      return 'La vérification SMS est bloquée sur cette adresse de prévisualisation. Ouvrez HAVEN depuis son domaine autorisé, puis réessayez.';
    case 'auth/quota-exceeded':
    case 'auth/too-many-requests':
      return 'La limite d’envoi de SMS est atteinte. Réessayez plus tard.';
    case 'auth/invalid-phone-number':
      return 'Ce numéro de téléphone n’est pas accepté. Vérifiez son indicatif et ses chiffres.';
    case 'auth/credential-already-in-use':
      return 'Ce numéro est déjà associé à un autre compte HAVEN.';
    case 'auth/provider-already-linked':
      return 'Un autre numéro est déjà lié à ce compte. Contactez l’assistance pour le remplacer.';
    case 'auth/invalid-verification-code':
      return 'Le code SMS est incorrect. Vérifiez-le puis réessayez.';
    case 'auth/code-expired':
    case 'auth/session-expired':
      return 'Le code SMS a expiré. Demandez un nouveau code.';
    case 'auth/network-request-failed':
      return 'La connexion a été interrompue. Vérifiez votre accès Internet puis réessayez.';
    default:
      return error instanceof Error && !code ? error.message : 'La vérification SMS a échoué. Réessayez dans quelques instants.';
  }
}
