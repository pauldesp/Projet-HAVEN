export interface UserFacingError {
  code: string;
  title: string;
  message: string;
}

const messages: Record<string, Omit<UserFacingError, 'code'>> = {
  '401': {
    title: 'Connexion requise',
    message: 'Votre session a expiré. Connectez-vous à nouveau pour continuer.',
  },
  '402': {
    title: 'Synchronisation indisponible',
    message: 'La synchronisation est momentanément indisponible. Réessayez dans quelques instants.',
  },
  '403': {
    title: 'Accès non autorisé',
    message: 'Vous n’avez pas l’autorisation nécessaire pour cette action.',
  },
  '404': {
    title: 'Élément introuvable',
    message: 'L’élément demandé n’est plus disponible.',
  },
  '409': {
    title: 'Action déjà effectuée',
    message: 'Cette action est déjà en cours ou a déjà été effectuée.',
  },
  '422': {
    title: 'Informations à vérifier',
    message: 'Certaines informations doivent être corrigées avant de continuer.',
  },
  '429': {
    title: 'Trop de tentatives',
    message: 'Veuillez patienter un instant avant de réessayer.',
  },
  '451': {
    title: 'Paiement indisponible',
    message: 'Le paiement est momentanément indisponible. Réessayez plus tard.',
  },
  '503': {
    title: 'Service indisponible',
    message: 'Un service HAVEN est momentanément indisponible. Réessayez plus tard.',
  },
  '500': {
    title: 'Problème temporaire',
    message: 'Une difficulté imprévue est survenue. Vos données n’ont pas été modifiées.',
  },
};

const rawError = (error: unknown) => {
  if (typeof error === 'string') return error.toLowerCase();
  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; message?: unknown; error?: unknown; status?: unknown };
    return [candidate.code, candidate.status, candidate.message, candidate.error]
      .filter(Boolean)
      .map(String)
      .join(' ')
      .toLowerCase();
  }
  return '';
};

/**
 * Converts every technical error into one stable, French support code.
 * Technical details stay in the browser console for diagnosis only.
 */
export const classifyError = (error: unknown): UserFacingError => {
  const detail = rawError(error);
  const existingCode = detail.match(/(?:erreur|error)\s+(401|402|403|404|409|422|429|451|500|503)\b/);
  if (existingCode) return { code: existingCode[1], ...messages[existingCode[1]] };
  let code = '500';

  if (/permission-denied|forbidden|unauthorized-domain|\b403\b/.test(detail)) code = '403';
  else if (/unauthenticated|not.?authenticated|session invalide|auth\/user|auth\/invalid|\b401\b/.test(detail)) code = '401';
  else if (/not-found|introuvable|\b404\b/.test(detail)) code = '404';
  else if (/already-exists|already exists|conflict|\b409\b/.test(detail)) code = '409';
  else if (/invalid|validation|malformed|failed-precondition|\b400\b|\b422\b/.test(detail)) code = '422';
  else if (/too-many|rate limit|\b429\b/.test(detail)) code = '429';
  else if (/stripe|checkout|payment|paiement/.test(detail)) code = '451';
  else if (/operation-not-allowed|provider.*disabled|\b503\b/.test(detail)) code = '503';
  else if (/unavailable|offline|network|timeout|fetch|firestore|internal assertion|unexpected state|\b502\b|\b504\b/.test(detail)) code = '402';

  return { code, ...messages[code] };
};

export const userFacingErrorMessage = (error: unknown) => {
  const classified = classifyError(error);
  return `${classified.message} (Erreur ${classified.code})`;
};

export const reportError = (error: unknown, context: string) => {
  const classified = classifyError(error);
  console.error(`[Erreur ${classified.code}] ${context}`, error);
  return classified;
};
