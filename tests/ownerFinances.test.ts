import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateOwnerFinanceStats } from '../services/ownerFinances';

const rent = {
  id: 'payment-rent', bookingId: 'booking-upcoming', listingId: 'listing-1', ownerId: 'owner-1', tenantId: 'tenant-1',
  amount: 180, status: 'COMPLETED' as const, type: 'RENT' as const, createdAt: '2026-09-28T12:00:00.000Z',
};

test('owner finance totals include completed rents, deduct refunds and forecast only paid upcoming stays', () => {
  const stats = calculateOwnerFinanceStats([
    { id: 'booking-upcoming', status: 'CONFIRMED', startDate: '2026-10-10', totalPrice: 180 },
    { id: 'booking-unpaid', status: 'CONFIRMED', startDate: '2026-10-12', totalPrice: 250 },
    { id: 'booking-past', status: 'CONFIRMED', startDate: '2026-09-10', totalPrice: 90 },
  ], [
    rent,
    { ...rent, id: 'payment-past', bookingId: 'booking-past', amount: 90 },
    { ...rent, id: 'refund-1', bookingId: 'booking-past', amount: 30, status: 'REFUNDED', type: 'REFUND' },
    { ...rent, id: 'pending-1', bookingId: 'booking-unpaid', amount: 250, status: 'PENDING' },
  ], new Date('2026-09-28T12:00:00.000Z'));

  assert.deepEqual(stats, { totalRevenue: 240, pendingRevenue: 180 });
});
