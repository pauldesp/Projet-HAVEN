import test from 'node:test';
import assert from 'node:assert/strict';
import { describeProductionConfiguration } from './productionConfiguration';

const complete = {
  APP_ORIGIN: 'https://havencoloc.fr',
  STRIPE_SECRET_KEY: 'sk_live_fake', STRIPE_WEBHOOK_SECRET: 'whsec_a', STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_b',
  RESEND_API_KEY: 're_fake', EMAIL_FROM: 'Haven <bonjour@havencoloc.fr>', EMAIL_REPLY_TO: 'contact@havencoloc.fr',
  HAVEN_TEAM_EMAIL: 'equipe@havencoloc.fr', RESERVATION_EMAIL_ENABLED: 'true', RESERVATION_EMAIL_START_AT: '2026-12-01T00:00:00.000Z',
  RESEND_TEMPLATES_ENABLED: 'true',
};

test('a complete production configuration reports nothing', () => {
  assert.deepEqual(describeProductionConfiguration(complete), { missing: [], warnings: [] });
});

test('missing secrets, plain HTTP and the Resend sandbox sender are reported by name only', () => {
  const { missing } = describeProductionConfiguration({ APP_ORIGIN: 'http://havencoloc.fr', EMAIL_FROM: 'Haven <onboarding@resend.dev>', PAYMENT_MODE: 'simulation' });
  for (const name of ['APP_ORIGIN', 'PAYMENT_MODE', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_CONNECT_WEBHOOK_SECRET', 'RESEND_API_KEY', 'EMAIL_FROM']) {
    assert.ok(missing.some(line => line.includes(name)), name);
  }
});

test('secret values never appear in the messages', () => {
  const { missing, warnings } = describeProductionConfiguration({ ...complete, STRIPE_SECRET_KEY: 'sk_test_secretvalue', RESERVATION_EMAIL_START_AT: 'demain' });
  assert.ok(warnings.some(line => line.includes('clé de test')));
  assert.ok(missing.some(line => line.includes('RESERVATION_EMAIL_START_AT')));
  assert.ok(![...missing, ...warnings].some(line => line.includes('secretvalue')));
});
