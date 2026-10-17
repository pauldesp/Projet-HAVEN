import test from 'node:test';
import assert from 'node:assert/strict';
import { arrivalInstant, instructionsDueAt, canReleaseArrivalInstructions, createReservationConfirmation, confirmationEmail, HAVEN_HOUSE_RULES } from './reservationFulfillment';
import { paymentReceiptPdf } from './paymentReceiptPdf';
import type { Booking } from '../types';

const booking = { id: 'b-test', listingId: 'listing', tenantId: 'tenant', ownerId: 'owner', startDate: '2026-11-07', endDate: '2026-11-14', paidAt: '2026-10-18T12:00:00Z', paymentProvider: 'SIMULATION', paymentIsTest: true, checkoutSessionId: 'sim_b-test', totalPrice: 181.5, basePrice: 140, cleaningFee: 20, platformFee: 21.5 } as Booking;

test('arrival schedule uses Paris local time in winter and summer, independently of process timezone', () => {
  assert.equal(arrivalInstant('2026-11-07').toISOString(), '2026-11-07T14:00:00.000Z');
  assert.equal(arrivalInstant('2026-07-07').toISOString(), '2026-07-07T13:00:00.000Z');
  assert.equal(instructionsDueAt(booking), '2026-11-04T14:00:00.000Z');
  assert.equal(instructionsDueAt({ ...booking, startDate: '2026-10-25' }), '2026-10-22T14:00:00.000Z');
});
test('last-minute bookings release instructions at confirmation, never in the past', () => {
  assert.equal(instructionsDueAt({ ...booking, paidAt: '2026-11-06T12:00:00Z' }), '2026-11-06T12:00:00.000Z');
});
test('confirmation snapshots address, fees, rules and reference without access codes', () => {
  const confirmation = createReservationConfirmation(booking, { title: 'Coloc', address: '12 rue du Test', city: 'Paris' }, { firstName: 'Alice', email: 'alice@example.test' });
  assert.equal(confirmation.address, '12 rue du Test, Paris');
  assert.equal(confirmation.amountCents, 18150);
  assert.deepEqual(confirmation.rules, HAVEN_HOUSE_RULES);
  assert.equal(confirmation.id, 'receipt-b-test');
  assert.equal('instructions' in confirmation, false);
});
test('confirmation email distinguishes test payments and escapes customer input; arrival email includes supplied instructions', () => {
  const data = createReservationConfirmation(booking, { title: '<img src=x>' }, { firstName: '<script>x</script>', email: 'alice@example.test' });
  const mail = confirmationEmail(data);
  assert.match(mail.subject, /^\[TEST\]/);
  assert.match(mail.text, /72 heures/);
  assert.match(mail.text, /aucun paiement réel/);
  assert.doesNotMatch(mail.html, /<script>|<img/);
  assert.match(confirmationEmail(data, 'Clés chez le gardien').text, /Clés chez le gardien/);
  assert.doesNotMatch(confirmationEmail(data, 'Clés chez le gardien').text, /justificatif de paiement est joint/);
});
test('download produces a genuine PDF for a persisted simulation receipt', async () => {
  const data = createReservationConfirmation(booking, { title: 'Coloc Martin', address: '12 rue du Test', city: 'Paris' }, { firstName: 'Alice', lastName: 'Test', email: 'alice@example.test' });
  const pdf = await paymentReceiptPdf(data);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 1500);
});

test('private entry instructions are hidden until the precise release time and from unpaid or cancelled bookings', () => {
  const due = '2026-11-04T14:00:00Z';
  const paid = { status: 'CONFIRMED' as const, paymentStatus: 'PAID' as const };
  assert.equal(canReleaseArrivalInstructions(paid, due, Date.parse(due) - 1), false);
  assert.equal(canReleaseArrivalInstructions(paid, due, Date.parse(due)), true);
  assert.equal(canReleaseArrivalInstructions({ ...paid, paymentStatus: 'PENDING' }, due, Date.parse(due)), false);
  assert.equal(canReleaseArrivalInstructions({ ...paid, status: 'CANCELLED' }, due, Date.parse(due)), false);
  assert.equal(canReleaseArrivalInstructions(paid, 'invalid'), false);
});
