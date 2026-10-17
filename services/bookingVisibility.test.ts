import assert from 'node:assert/strict';
import test from 'node:test';
import type { Booking } from '../types';
import { isOwnerBookingVisible, isBookingVisibleToParticipant } from './bookingVisibility';
const base = { tenantId: 'tenant', ownerId: 'owner', status: 'PENDING', paymentStatus: 'PENDING' } as Booking;

test('unpaid attempts never appear in the proprietor dashboard, including abandoned/expired attempts', () => {
  for (const status of ['PENDING', 'APPROVED', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const) {
    assert.equal(isOwnerBookingVisible({ ...base, status }), false);
    assert.equal(isBookingVisibleToParticipant({ ...base, status }, 'owner'), false);
  }
  assert.equal(isOwnerBookingVisible({ status: 'CONFIRMED' }), false);
  assert.equal(isOwnerBookingVisible({ status: 'PENDING', paymentStatus: 'PAID' }), false);
});
test('payment and confirmation expose the stay immediately; paid history is preserved', () => {
  for (const status of ['CONFIRMED', 'COMPLETED', 'CANCELLED'] as const) {
    assert.equal(isOwnerBookingVisible({ ...base, status, paymentStatus: 'PAID' }), true);
  }
});
test('the tenant can resume their own checkout but a different member cannot see it', () => {
  assert.equal(isBookingVisibleToParticipant(base, 'tenant'), true);
  assert.equal(isBookingVisibleToParticipant(base, 'stranger'), false);
});
