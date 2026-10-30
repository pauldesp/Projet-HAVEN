// Keep the usual command convenient: Stripe test keys start the signed relay too.
if (process.env.PAYMENT_MODE === 'stripe' && process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  await import('./dev-stripe.mjs');
} else {
  await import('../server.ts');
}
