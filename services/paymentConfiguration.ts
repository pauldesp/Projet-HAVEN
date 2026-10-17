export type PaymentMode = 'SIMULATION' | 'STRIPE';
export class PaymentConfigurationError extends Error {
  status = 503;
}
export function getPaymentMode(env: Record<string, string | undefined> = process.env): PaymentMode {
  const configured = (env.PAYMENT_MODE || (env.NODE_ENV === 'production' ? 'stripe' : 'simulation')).toLowerCase();
  if (configured !== 'simulation' && configured !== 'stripe') throw new PaymentConfigurationError('Mode de paiement invalide.');
  if (configured === 'simulation') {
    if (env.NODE_ENV === 'production') throw new PaymentConfigurationError('La simulation de paiement est interdite en production.');
    return 'SIMULATION';
  }
  if (!/^sk_(test|live)_[a-zA-Z0-9]+$/.test(env.STRIPE_SECRET_KEY || '') || !/^whsec_[a-zA-Z0-9]+$/.test(env.STRIPE_WEBHOOK_SECRET || '')) {
    throw new PaymentConfigurationError('Le paiement Stripe n’est pas encore configuré.');
  }
  if (env.NODE_ENV === 'production') {
    try { if (new URL(env.APP_ORIGIN || '').protocol !== 'https:') throw new Error(); }
    catch { throw new PaymentConfigurationError('L’adresse HTTPS du site doit être configurée avant d’activer le paiement.'); }
  }
  return 'STRIPE';
}
