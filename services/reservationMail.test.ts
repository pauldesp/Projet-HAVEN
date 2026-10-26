import test from 'node:test';
import assert from 'node:assert/strict';
import type { Booking } from '../types';
import { createReservationConfirmation } from './reservationFulfillment';
import { canSendReservationRecipient, departureReminderDueAt, initialReservationMailJobs, reservationMailJob, reservationMailDisposition, reservationLifecycleEmail, reservationEmailConfiguration, type ReservationMailKind } from './reservationMail';

const booking = { id: 'b-email', tenantId: 'tenant', ownerId: 'owner', listingId: 'listing', startDate: '2026-11-07', endDate: '2026-11-14', paidAt: '2026-11-01T12:00:00Z', status: 'CONFIRMED', paymentStatus: 'PAID', totalPrice: 180, basePrice: 140, cleaningFee: 20, platformFee: 20, paymentProvider: 'SIMULATION', paymentIsTest: true } as Booking;
const receipt = createReservationConfirmation(booking, { title: 'Maison <Exemple>', address: '12 rue Exemple' }, { firstName: 'Camille', email: 'camille@example.com' });
const cutover = '2026-11-01T00:00:00Z';

test('payment schedules immediate confirmation, arrival at 72h and departure on the previous local day', () => {
  const jobs = initialReservationMailJobs(receipt);
  assert.deepEqual(jobs.map(job => [job.kind, job.nextAttemptAt]), [
    ['CONFIRMATION', booking.paidAt], ['ARRIVAL', '2026-11-04T14:00:00.000Z'], ['DEPARTURE_REMINDER', '2026-11-13T09:00:00.000Z'],
  ]);
  assert.equal(departureReminderDueAt({ ...receipt, endDate: '2026-10-26', paidAt: '2026-10-01T12:00:00Z' }), '2026-10-25T09:00:00.000Z');
  assert.equal(departureReminderDueAt({ ...receipt, endDate: '2026-03-30', paidAt: '2026-03-01T12:00:00Z' }), '2026-03-29T08:00:00.000Z');
  assert.equal(departureReminderDueAt({ ...receipt, paidAt: '2026-11-14T07:00:00Z' }), '2026-11-14T07:00:00.000Z');
});
test('cancelled, unpaid, finished and pre-activation bookings do not receive scheduled reminders', () => {
  const job = reservationMailJob(booking.id, 'ARRIVAL', receipt.instructionsDueAt);
  const now = Date.parse('2026-11-06T12:00:00Z');
  assert.equal(reservationMailDisposition(job, booking, receipt, cutover, now), 'SEND');
  for (const changed of [{ ...booking, status: 'CANCELLED' }, { ...booking, paymentStatus: 'PENDING' }]) assert.equal(reservationMailDisposition(job, changed as Booking, receipt, cutover, now), 'CANCELLED');
  assert.equal(reservationMailDisposition(job, booking, receipt, '2026-11-02T00:00:00Z', now), 'CANCELLED');
  assert.equal(reservationMailDisposition(job, { ...booking, status: 'COMPLETED' }, receipt, cutover, now), 'EXPIRED');
  assert.equal(reservationMailDisposition(job, { ...booking, checkInReportId: 'in' }, receipt, cutover, now), 'EXPIRED');
  assert.equal(reservationMailDisposition(job, booking, receipt, cutover, Date.parse('2026-11-14T10:00:00Z')), 'EXPIRED');
  assert.equal(reservationMailDisposition(job, booking, receipt, cutover, Date.parse('2026-11-04T13:59:59Z')), 'WAIT');
});
test('only the linked saved inspection triggers its corresponding event and stale events expire', () => {
  const job = reservationMailJob(booking.id, 'CHECKOUT', '2026-11-14T09:30:00Z', 'out');
  const completed = { ...booking, status: 'COMPLETED', checkOutReportId: 'out' } as Booking;
  const now = Date.parse('2026-11-14T09:31:00Z');
  assert.equal(reservationMailDisposition(job, completed, receipt, cutover, now), 'SEND');
  assert.equal(reservationMailDisposition(job, booking, receipt, cutover, now), 'CANCELLED');
  assert.equal(reservationMailDisposition(job, completed, receipt, cutover, now + 25 * 3600_000), 'EXPIRED');
  assert.equal(reservationMailDisposition({ ...job, firstSendAttemptAt: '2026-11-13T12:00:00Z' }, completed, receipt, cutover, now), 'REVIEW_REQUIRED');
});
test('automation remains paused until explicitly enabled with a valid fixed cutover date', () => {
  assert.equal(reservationEmailConfiguration({}).enabled, false);
  assert.equal(reservationEmailConfiguration({ RESERVATION_EMAIL_ENABLED: 'true', RESERVATION_EMAIL_START_AT: 'invalid' }).enabled, false);
  assert.equal(reservationEmailConfiguration({ RESERVATION_EMAIL_ENABLED: 'true', RESERVATION_EMAIL_START_AT: cutover }).enabled, true);
});
test('five messages have specific content, escaped data and no invented successful owner inspection', () => {
  for (const kind of ['CONFIRMATION', 'ARRIVAL', 'CHECKIN', 'DEPARTURE_REMINDER', 'CHECKOUT'] as ReservationMailKind[]) {
    const mail = reservationLifecycleEmail(kind, receipt, { occurredAt: '2026-11-07T15:00:00Z', appOrigin: 'https://haven.example' });
    assert.match(mail.subject, /^\[TEST\]/);
    assert.match(mail.text, /aucun paiement réel/);
    assert.doesNotMatch(mail.html, /Maison <Exemple>/);
    assert.match(mail.html, /Maison &lt;Exemple&gt;/);
    assert.match(mail.html, /https:\/\/haven.example\/#\/dashboard/);
    if (kind === 'CHECKIN') assert.match(mail.text, /observations et vos photos/);
    if (kind === 'CHECKOUT') assert.match(mail.text, /déclaration de dépôt des clés/);
    if (kind === 'DEPARTURE_REMINDER') assert.match(mail.text, /départ anticipé/);
  }
  assert.match(reservationLifecycleEmail('ARRIVAL', receipt, { instructions: 'Code privé 1234' }).text, /Code privé 1234/);
  for (const kind of ['CONFIRMATION', 'CHECKIN', 'DEPARTURE_REMINDER', 'CHECKOUT'] as ReservationMailKind[]) assert.doesNotMatch(reservationLifecycleEmail(kind, receipt, { instructions: 'Code privé 1234' }).text, /Code privé 1234/);
});

test('demo sending is restricted to the account owner without redirecting another tenant', () => {
  assert.equal(canSendReservationRecipient('Haven <onboarding@resend.dev>', 'owner@example.com', 'owner@example.com'), true);
  assert.equal(canSendReservationRecipient('Haven <onboarding@resend.dev>', 'tenant@example.com', 'owner@example.com'), false);
  assert.equal(canSendReservationRecipient('Haven <onboarding@resend.dev>', 'owner@example.com'), false);
  assert.equal(canSendReservationRecipient('Haven <bonjour@haven.example>', 'tenant@example.com'), true);
});
