import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../pages/TenantDashboard.tsx', import.meta.url), 'utf8');
const sanitizer = readFileSync(new URL('../services/sanitizeHtml.ts', import.meta.url), 'utf8');

test('self-created profiles cannot request privileged roles or approval', () => {
  assert.match(rules, /data\.role == 'TENANT'/);
  assert.match(rules, /data\.status == 'PENDING'/);
  assert.match(rules, /incoming\(\)\.status == existing\(\)\.status/);
});

test('administrative profiles remain private to administrators', () => {
  assert.match(rules, /allow get: if isAdmin\(\) \|\| \(isSignedIn\(\) && resource\.data\.role != 'ADMIN'\)/);
  assert.match(rules, /function isPrimaryAdmin\(\)/);
  assert.match(rules, /match \/admin_audit\/\{entryId\}[\s\S]*allow read, write: if false/);
});

test('booking creation and transitions are constrained', () => {
  assert.match(rules, /allow create: if isTenantVerified\(\) && isValidBooking\(incoming\(\)\)/);
  assert.match(rules, /incoming\(\)\.tenantId == request\.auth\.uid && incoming\(\)\.status == 'PENDING'/);
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(\['status', 'approvedAt'\]\)/);
});

test('publication requires an approved owner dossier', () => {
  assert.match(rules, /function isOwnerVerified\(\)/);
  assert.match(rules, /hasVerificationDocument\('proofOfOwnership'\)/);
  assert.match(rules, /isOwnerVerified\(\) && isValidListing\(incoming\(\)\)/);
});

test('dossier submission is authenticated and remains pending for human review', () => {
  assert.match(server, /submit-verification", sensitiveApiLimiter, requireAuth/);
  assert.match(server, /await userRef\.update\(\{ status: "PENDING"/);
});

test('checkout requires authentication and Stripe webhook verification', () => {
  assert.match(server, /create-checkout-session", sensitiveApiLimiter, requireAuth/);
  assert.match(server, /webhooks\.constructEvent/);
  assert.match(server, /payment_status === "paid"/);
});

test('preview checkout records a server-side simulated payment', () => {
  assert.match(server, /const completeMockCheckout = async/);
  assert.match(server, /mock_payment_\$\{bookingId\}/);
  assert.match(server, /paymentStatus: "PAID"/);
});

test('the browser cannot confirm a booking from redirect parameters', () => {
  assert.doesNotMatch(dashboard, /bookingResult === 'success'/);
  assert.doesNotMatch(dashboard, /updateStatus\(bookingId, 'CONFIRMED'\)/);
});

test('rich HTML is sanitized and sensitive endpoints are rate limited', () => {
  assert.match(sanitizer, /DOMPurify\.sanitize/);
  assert.match(server, /send-verification", verificationLimiter/);
  assert.match(server, /create-checkout-session", sensitiveApiLimiter, requireAuth/);
});
