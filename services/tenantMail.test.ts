import test from 'node:test';
import assert from 'node:assert/strict';
import type { Booking } from '../types';
import { accountDecisionMail, cancellationMail, reviewInvitationMail, tenantMailDisposition, tenantNotificationEmail } from './tenantMail';

const at = '2026-11-08T10:00:00.000Z';
const startAt = '2026-11-01T00:00:00.000Z';
const profile = { role: 'TENANT', firstName: '<Camille>', email: 'camille@example.com', status: 'APPROVED', approvedAt: at };
const booking = { id: 'booking', tenantId: 'tenant', ownerId: 'owner', listingId: 'listing', listingTitle: 'Maison Exemple', roomName: 'Horizon', startDate: '2026-11-01', endDate: '2026-11-08', paymentStatus: 'PAID', paymentProvider: 'SIMULATION', paymentIsTest: true, status: 'COMPLETED', completedAt: at, checkOutReportId: 'out-report' } as Booking;

test('account notifications are planned only for tenants and remain bound to the current decision', () => {
  const job = accountDecisionMail('tenant', profile, 'ACCOUNT_APPROVED', at)!;
  const now = Date.parse(at);
  assert.equal(accountDecisionMail('owner', { ...profile, role: 'OWNER' }, 'ACCOUNT_APPROVED', at), undefined);
  assert.equal(tenantMailDisposition(job, profile, undefined, false, startAt, now), 'SEND');
  assert.equal(tenantMailDisposition(job, { ...profile, status: 'PENDING' }, undefined, false, startAt, now), 'CANCELLED');
  assert.equal(tenantMailDisposition(job, { ...profile, approvedAt: '2026-11-08T11:00:00Z' }, undefined, false, startAt, now), 'CANCELLED');
});
test('correction notifications expire when a corrected dossier is resubmitted or approved', () => {
  const job = accountDecisionMail('tenant', profile, 'ACCOUNT_CORRECTION', at)!;
  const rejected = { ...profile, status: 'REJECTED', moderatedAt: at, rejectionReason: 'Photo illisible : <script>alert(1)</script>' };
  assert.equal(tenantMailDisposition(job, rejected, undefined, false, startAt, Date.parse(at)), 'SEND');
  assert.equal(tenantMailDisposition(job, { ...rejected, status: 'PENDING' }, undefined, false, startAt, Date.parse(at)), 'CANCELLED');
  assert.equal(tenantMailDisposition(job, profile, undefined, false, startAt, Date.parse(at)), 'CANCELLED');
  const mail = tenantNotificationEmail(job, rejected, undefined, undefined, 'https://haven.example');
  assert.match(mail.text, /Photo illisible/);
  assert.match(mail.html, /&lt;script&gt;/);
  assert.doesNotMatch(mail.html, /<script>/);
  assert.match(mail.html, />Mon compte<\/a>/);
});
test('exceptional approvals stay explicitly marked test and are invalid after revocation', () => {
  const job = accountDecisionMail('tenant', profile, 'ACCOUNT_APPROVED', at, 'decision')!;
  const exceptional = { ...profile, verificationException: { decisionId: 'decision' } };
  assert.equal(tenantMailDisposition(job, exceptional, undefined, false, startAt, Date.parse(at)), 'SEND');
  assert.equal(tenantMailDisposition(job, profile, undefined, false, startAt, Date.parse(at)), 'CANCELLED');
  assert.match(tenantNotificationEmail(job, exceptional).subject, /^\[TEST\]/);
  assert.match(tenantNotificationEmail(job, exceptional).text, /validation exceptionnelle de test/);
});
test('only a completed paid stay plans a single review invitation 24h after actual checkout', () => {
  const job = reviewInvitationMail(booking)!;
  assert.equal(job.nextAttemptAt, '2026-11-09T10:00:00.000Z');
  assert.equal(reviewInvitationMail({ ...booking, status: 'CONFIRMED' }), undefined);
  assert.equal(reviewInvitationMail({ ...booking, paymentStatus: 'PENDING' }), undefined);
  assert.equal(tenantMailDisposition(job, profile, booking, false, startAt, Date.parse(at) + 24 * 3600_000 - 1), 'WAIT');
  assert.equal(tenantMailDisposition(job, profile, booking, false, startAt, Date.parse(at) + 24 * 3600_000), 'SEND');
  assert.equal(tenantMailDisposition(job, profile, booking, true, startAt, Date.parse(at) + 24 * 3600_000), 'CANCELLED');
  assert.equal(tenantMailDisposition(job, profile, booking, false, startAt, Date.parse(at) + 7 * 86400_000), 'EXPIRED');
});
test('review invitation never follows a cancelled stay or another tenant and explains the existing Noter action', () => {
  const job = reviewInvitationMail(booking)!;
  const now = Date.parse(at) + 86400_000;
  assert.equal(tenantMailDisposition(job, profile, { ...booking, status: 'CANCELLED' }, false, startAt, now), 'CANCELLED');
  assert.equal(tenantMailDisposition(job, profile, { ...booking, tenantId: 'someone-else' }, false, startAt, now), 'CANCELLED');
  assert.match(tenantNotificationEmail(job, profile, booking).text, /Historique.*Noter/);
});
test('cancellation mail requires a recorded paid cancellation and distinguishes simulated refunds', () => {
  const cancelled = { ...booking, status: 'CANCELLED', cancellation: { cancelledAt: at, cancelledBy: 'TENANT', reason: 'Changement de programme', refundPercent: 50, refundAmount: 90, refundStatus: 'SIMULATED' } } as Booking;
  const job = cancellationMail(cancelled)!;
  assert.equal(cancellationMail({ ...cancelled, paymentStatus: 'PENDING' }), undefined);
  assert.equal(tenantMailDisposition(job, profile, cancelled, false, startAt, Date.parse(at)), 'SEND');
  assert.equal(tenantMailDisposition(job, profile, booking, false, startAt, Date.parse(at)), 'CANCELLED');
  const mail = tenantNotificationEmail(job, profile, cancelled);
  assert.match(mail.text, /Changement de programme/);
  assert.match(mail.text, /Remboursement simulé/);
  assert.match(mail.text, /Aucun remboursement bancaire réel/);
  assert.match(mail.subject, /^\[TEST\]/);
  const real = { ...cancelled, paymentIsTest: false, paymentProvider: 'STRIPE', cancellation: { ...cancelled.cancellation!, refundStatus: 'COMPLETED' } } as Booking;
  assert.match(tenantNotificationEmail(job, profile, real).text, /Remboursement enregistré/);
  assert.doesNotMatch(tenantNotificationEmail(job, profile, real).text, /remboursement.*reçu sur votre compte/i);
});
test('new notifications respect activation and do not revive stale historical events', () => {
  const job = accountDecisionMail('tenant', profile, 'ACCOUNT_APPROVED', at)!;
  assert.equal(tenantMailDisposition(job, profile, undefined, false, '2026-11-09T00:00:00Z', Date.parse(at)), 'CANCELLED');
  assert.equal(tenantMailDisposition(job, profile, undefined, false, startAt, Date.parse(at) + 7 * 86400_000), 'EXPIRED');
});
