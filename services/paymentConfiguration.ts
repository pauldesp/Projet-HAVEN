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

/** Hosted Connect returns may use HTTP only for local development with test keys. */
export function getConnectConfiguration(env: Record<string, string | undefined> = process.env) {
  const isTest = !env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
  try {
    const origin = new URL(env.APP_ORIGIN || '');
    const host = origin.hostname;
    const octets = host.split('.').map(Number);
    const privateIPv4 = octets.length === 4 && octets.every(value => Number.isInteger(value) && value >= 0 && value <= 255) &&
      (octets[0] === 10 || octets[0] === 127 || (octets[0] === 192 && octets[1] === 168) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
    const local = host === 'localhost' || host === '[::1]' || host.endsWith('.local') || privateIPv4;
    const allowedOrigin = origin.protocol === 'https:' || (env.NODE_ENV !== 'production' && isTest && origin.protocol === 'http:' && local);
    const enabled = getPaymentMode(env) === 'STRIPE' && /^whsec_[a-zA-Z0-9]+$/.test(env.STRIPE_CONNECT_WEBHOOK_SECRET || '') && allowedOrigin && !origin.username && !origin.password;
    return { enabled: Boolean(enabled), isTest };
  } catch { return { enabled: false, isTest }; }
}
