import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../pages/TenantDashboard.tsx', import.meta.url), 'utf8');

test('self-created profiles cannot request privileged roles or approval', () => {
  assert.match(rules, /data\.role == 'TENANT'/);
  assert.match(rules, /data\.status == 'PENDING'/);
  assert.match(rules, /incoming\(\)\.status == existing\(\)\.status/);
});

test('booking creation and transitions are constrained', () => {
  assert.match(rules, /incoming\(\)\.tenantId == request\.auth\.uid && incoming\(\)\.status == 'PENDING'/);
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(\['status', 'approvedAt'\]\)/);
});

test('checkout requires authentication and Stripe webhook verification', () => {
  assert.match(server, /create-checkout-session", requireAuth/);
  assert.match(server, /webhooks\.constructEvent/);
  assert.match(server, /payment_status === "paid"/);
});

test('the browser cannot confirm a booking from redirect parameters', () => {
  assert.doesNotMatch(dashboard, /bookingResult === 'success'/);
  assert.doesNotMatch(dashboard, /updateStatus\(bookingId, 'CONFIRMED'\)/);
});
