// Checks run when the production server starts. Only names are reported, never values:
// the messages land in the host's logs.
type Env = Record<string, string | undefined>;

const filled = (value: string | undefined) => Boolean(value?.trim());

export function describeProductionConfiguration(env: Env) {
  const missing: string[] = [];
  const warnings: string[] = [];

  try {
    const origin = new URL(env.APP_ORIGIN || '');
    if (origin.protocol !== 'https:') missing.push('APP_ORIGIN doit être une adresse https:// (liens des e-mails, retours Stripe).');
    else if (origin.pathname !== '/' || origin.search || origin.hash) warnings.push('APP_ORIGIN ne doit contenir que le domaine, sans chemin.');
  } catch {
    missing.push('APP_ORIGIN (adresse publique du site, par exemple https://havencoloc.fr).');
  }

  if ((env.PAYMENT_MODE || 'stripe').toLowerCase() === 'simulation') missing.push('PAYMENT_MODE=simulation est interdit en production.');
  for (const name of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_CONNECT_WEBHOOK_SECRET', 'RESEND_API_KEY']) {
    if (!filled(env[name])) missing.push(name);
  }
  if (env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) warnings.push('STRIPE_SECRET_KEY est une clé de test : aucun paiement réel ne sera encaissé.');

  if (!filled(env.EMAIL_FROM) || env.EMAIL_FROM!.includes('onboarding@resend.dev')) {
    missing.push('EMAIL_FROM (expéditeur sur un domaine validé dans Resend) : aucun e-mail ne part sans lui.');
  }
  if (!filled(env.EMAIL_REPLY_TO)) warnings.push('EMAIL_REPLY_TO absent : les réponses aux e-mails ne seront pas reçues.');
  if (!filled(env.HAVEN_TEAM_EMAIL)) warnings.push('HAVEN_TEAM_EMAIL absent : les alertes de l’équipe partent vers EMAIL_REPLY_TO.');
  if (env.RESERVATION_EMAIL_ENABLED !== 'true') warnings.push('RESERVATION_EMAIL_ENABLED n’est pas à true : les e-mails de séjour sont désactivés.');
  else if (Number.isNaN(Date.parse(env.RESERVATION_EMAIL_START_AT || ''))) missing.push('RESERVATION_EMAIL_START_AT (date fixe d’activation des e-mails de séjour).');
  if (env.RESEND_TEMPLATES_ENABLED !== 'true') warnings.push('RESEND_TEMPLATES_ENABLED n’est pas à true : les modèles Resend ne sont pas utilisés.');
  if (env.RESEND_TEST_EMAIL_TO) warnings.push('RESEND_TEST_EMAIL_TO est renseigné : à retirer en production.');

  return { missing, warnings };
}
