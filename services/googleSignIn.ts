import { userFacingErrorMessage } from './errorHandling';

/** Call the provider immediately, while the browser still has the user's tap. */
export function createGooglePopupSignIn<TUser>(actions: {
  openPopup: () => Promise<{ user: TUser }>;
  completeProfile: (user: TUser) => Promise<unknown>;
}) {
  let inFlight: Promise<boolean> | null = null;
  return () => {
    if (inFlight) return inFlight;
    const operation = (async () => {
      const result = await actions.openPopup();
      if (!result?.user) throw new Error('La connexion Google n’a pas abouti. Réessayez.');
      await actions.completeProfile(result.user);
      return true;
    })();
    inFlight = operation;
    const release = () => { if (inFlight === operation) inFlight = null; };
    void operation.then(release, release);
    return operation;
  };
}

export function googleSignInErrorMessage(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case 'auth/popup-blocked':
      return 'La fenêtre Google a été bloquée. Autorisez son ouverture pour ce site, puis réessayez.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'La fenêtre Google a été fermée avant la fin de la connexion. Vous pouvez réessayer.';
    case 'auth/unauthorized-domain':
      return 'La connexion Google n’est pas encore autorisée depuis cette adresse. (Erreur 403)';
    case 'auth/operation-not-allowed':
      return 'La connexion Google est momentanément indisponible. (Erreur 503)';
    case 'auth/account-exists-with-different-credential':
      return 'Un compte utilise déjà cette adresse e-mail avec un autre mode de connexion. Connectez-vous avec votre adresse e-mail et votre mot de passe.';
    case 'auth/web-storage-unsupported':
      return 'Le navigateur empêche la connexion Google. Réessayez dans une fenêtre normale ou connectez-vous avec votre adresse e-mail.';
    default:
      return userFacingErrorMessage(error);
  }
}
