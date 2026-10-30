import test from 'node:test';
import assert from 'node:assert/strict';
import { getPaymentMode, getConnectConfiguration } from './paymentConfiguration';
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

test('Connect test environment supports mobile LAN returns without permitting HTTP live payments', () => {
  const env = { ...stripe, STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_connect123' };
  for (const APP_ORIGIN of ['http://localhost:3000', 'http://macbook-pro-de-desplanques.local:3000', 'http://192.168.1.25:3000', 'http://10.0.0.3:3000']) {
    assert.equal(getConnectConfiguration({ ...env, APP_ORIGIN }).enabled, true);
    assert.equal(getConnectConfiguration({ ...env, APP_ORIGIN, STRIPE_SECRET_KEY: 'sk_live_fake123' }).enabled, false);
    assert.equal(getConnectConfiguration({ ...env, APP_ORIGIN, NODE_ENV: 'production' }).enabled, false);
  }
  assert.equal(getConnectConfiguration({ ...env, APP_ORIGIN: 'http://external.example' }).enabled, false);
  assert.equal(getConnectConfiguration({ ...env, APP_ORIGIN: 'https://user:pass@haven.example' }).enabled, false);
  assert.equal(getConnectConfiguration({ ...env, STRIPE_CONNECT_WEBHOOK_SECRET: undefined }).enabled, false);
});
