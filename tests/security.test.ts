import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../pages/TenantDashboard.tsx', import.meta.url), 'utf8');
const bookingModal = readFileSync(new URL('../components/BookingModal.tsx', import.meta.url), 'utf8');
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

test('stay reviews require a completed booking and cannot be edited or deleted', () => {
  assert.match(server, /\/api\/bookings\/:bookingId\/complete/);
  assert.match(server, /checkOutReportId/);
  assert.match(server, /\/api\/bookings\/:bookingId\/review/);
  assert.match(server, /isStayReviewWindowOpen\(current\.completedAt, current\.endDate\)/);
  assert.match(server, /createAutomaticReviewIfExpired/);
  assert.match(rules, /match \/reviews\/\{reviewId\}[\s\S]*allow create, update, delete: if false/);
});

test('reservation creation is atomic and snapshots owner arrival and departure hours', () => {
  assert.match(server, /app\.post\('\/api\/bookings', sensitiveApiLimiter, requireAuth/);
  assert.match(server, /transaction\.create\(bookingRef, booking\)/);
  assert.match(server, /checkInTime: listing\.checkInTime \|\| '15:00'/);
  assert.match(server, /checkOutTime: listing\.checkOutTime \|\| '11:00'/);
  assert.match(bookingModal, /Arrivée à partir de \{listing\.checkInTime \|\| '15:00'\}/);
  assert.match(bookingModal, /Départ avant \{listing\.checkOutTime \|\| '11:00'\}/);
});

test('housemate preview tolerates stale individual profiles without failing the whole listing', () => {
  assert.match(server, /Skipping unavailable housemate profile/);
  assert.match(server, /profilesById = new Map/);
  assert.match(server, /shareProfileWithHousemates/);
});

test('publication requires an approved owner dossier', () => {
  assert.match(rules, /function isOwnerVerified\(\)/);
  assert.match(rules, /hasVerificationDocument\('idCard'\)/);
  assert.doesNotMatch(rules, /hasVerificationDocument\('proofOfOwnership'\)/);
  assert.doesNotMatch(rules, /hasVerificationDocument\('proofOfAddress'\)/);
  assert.match(rules, /isOwnerVerified\(\) && isValidListing\(incoming\(\)\)/);
});

test('dossier submission is authenticated and remains pending for human review', () => {
  assert.match(server, /submit-verification", sensitiveApiLimiter, requireAuth/);
  assert.match(server, /await userRef\.update\(\{ status: "PENDING"/);
});

test('uploading an identity document always resets approval for a manual review', () => {
  assert.match(server, /identity-document", sensitiveApiLimiter, requireAuth/);
  assert.match(server, /identityVerified: false,[\s\S]*isVerified: false/);
  assert.match(server, /status: "PENDING"/);
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
