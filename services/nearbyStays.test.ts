import assert from 'node:assert/strict';
import test from 'node:test';
import { findClosestAvailableStay } from './nearbyStays';

const listing = {
  id: 'listing-1',
  blockedDates: [],
  rooms: [{ id: 'room-1', blockedDates: [] }],
} as any;

const booked = {
  id: 'booking-1', bookingId: 'booking-1', listingId: 'listing-1', roomId: 'room-1',
  startDate: '2026-10-10', endDate: '2026-10-17', status: 'CONFIRMED', updatedAt: '',
} as const;

test('suggests the nearest available stay with the same duration', () => {
  const stay = findClosestAvailableStay(listing, [booked], '2026-10-10', '2026-10-17', new Date('2026-09-23T12:00:00'));
  assert.deepEqual(stay, { startDate: '2026-10-03', endDate: '2026-10-10', offsetDays: -7 });
});

test('does not suggest dates before today', () => {
  const stay = findClosestAvailableStay(listing, [{ ...booked, startDate: '2026-09-23', endDate: '2026-10-01' }], '2026-09-24', '2026-10-01', new Date('2026-09-23T12:00:00'));
  assert.deepEqual(stay, { startDate: '2026-10-01', endDate: '2026-10-08', offsetDays: 7 });
});
