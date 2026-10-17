import test from 'node:test';
import assert from 'node:assert/strict';
import type { Booking } from '../types';
import { preparePaymentConfirmation, simulationSessionId, type PaymentReceipt } from './paymentCheckout';
import { isOwnerBookingVisible } from './bookingVisibility';

const now = new Date('2026-10-18T12:01:00Z');
const booking = { id: 'b-test', tenantId: 'tenant', ownerId: 'owner', listingId: 'listing', roomId: 'room', startDate: '2026-11-07', endDate: '2026-11-14', createdAt: '2026-10-18T12:00:00Z', status: 'PENDING', paymentStatus: 'PENDING', totalPrice: 161, basePrice: 140, platformFee: 21, cleaningFee: 0, paymentProvider: 'SIMULATION', checkoutSessionId: simulationSessionId('b-test') } as Booking;
const receipt: PaymentReceipt = { bookingId: booking.id, sessionId: simulationSessionId(booking.id), provider: 'SIMULATION', amountCents: 16100, currency: 'eur', isTest: true };

test('simulation and Stripe share the same confirmation, calendar, payment record and proprietor visibility', () => {
  assert.equal(isOwnerBookingVisible(booking), false);
  for (const provider of ['SIMULATION', 'STRIPE'] as const) {
    const result = preparePaymentConfirmation({ ...booking, paymentProvider: provider }, { ...receipt, provider, isTest: provider === 'SIMULATION' }, now);
    assert.equal(result.disposition, 'CONFIRM');
    if (result.disposition !== 'CONFIRM') throw new Error('Missing confirmation');
    assert.equal(isOwnerBookingVisible({ ...booking, ...result.bookingUpdate }), true);
    assert.equal(result.payment.amount, 161);
    assert.equal(result.payment.provider, provider);
    assert.equal(result.payment.isTest, provider === 'SIMULATION');
    assert.equal(result.availability.status, 'CONFIRMED');
    assert.equal(result.message.bookingId, booking.id);
  }
});
test('confirmation is repeatable without duplicating an already settled payment', () => {
  const first = preparePaymentConfirmation(booking, receipt, now);
  if (first.disposition !== 'CONFIRM') throw new Error('Missing confirmation');
  const repeat = preparePaymentConfirmation({ ...booking, ...first.bookingUpdate }, receipt, now);
  assert.equal(repeat.disposition, 'DUPLICATE');
  assert.equal('payment' in repeat, false);
});
test('wrong provider, currency, amount, session, booking or expired/cancelled attempt cannot confirm a stay', () => {
  for (const invalid of [{ ...receipt, amountCents: 1 }, { ...receipt, currency: 'usd' }, { ...receipt, provider: 'STRIPE' as const }, { ...receipt, sessionId: 'other' }, { ...receipt, bookingId: 'other' }, { ...receipt, isTest: false }]) {
    assert.equal(preparePaymentConfirmation(booking, invalid, now).disposition, 'REFUND');
  }
  assert.equal(preparePaymentConfirmation({ ...booking, status: 'CANCELLED' }, receipt, now).disposition, 'REFUND');
  assert.equal(preparePaymentConfirmation(booking, receipt, new Date('2026-10-18T12:30:00Z')).disposition, 'REFUND');
});
