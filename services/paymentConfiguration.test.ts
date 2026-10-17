import test from 'node:test';
import assert from 'node:assert/strict';
import { getPaymentMode } from './paymentConfiguration';
const stripe = { PAYMENT_MODE: 'stripe', STRIPE_SECRET_KEY: 'sk_test_fake123456', STRIPE_WEBHOOK_SECRET: 'whsec_fake123456', APP_ORIGIN: 'https://haven.example' };

test('development simulation is explicit and never depends on a Stripe failure', () => {
  assert.equal(getPaymentMode({}), 'SIMULATION');
  assert.equal(getPaymentMode({ PAYMENT_MODE: 'simulation', STRIPE_SECRET_KEY: 'invalid' }), 'SIMULATION');
  assert.throws(() => getPaymentMode({ PAYMENT_MODE: 'stripe' }), /configuré/);
  assert.throws(() => getPaymentMode({ PAYMENT_MODE: 'unknown' }), /invalide/);
});
test('production can never enable simulation or proceed without Stripe and HTTPS configuration', () => {
  assert.throws(() => getPaymentMode({ NODE_ENV: 'production', PAYMENT_MODE: 'simulation' }), /interdite/);
  assert.throws(() => getPaymentMode({ NODE_ENV: 'production' }), /configuré/);
  assert.throws(() => getPaymentMode({ ...stripe, NODE_ENV: 'production', APP_ORIGIN: 'http://haven.example' }), /HTTPS/);
  assert.equal(getPaymentMode({ ...stripe, NODE_ENV: 'production' }), 'STRIPE');
  assert.equal(getPaymentMode(stripe), 'STRIPE');
});
