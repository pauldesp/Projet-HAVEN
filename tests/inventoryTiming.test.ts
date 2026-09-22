import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getInventoryTiming } from '../services/inventoryTiming';
import { Booking } from '../types';

const booking = {
  id: 'booking-1',
  startDate: '2026-09-18',
  endDate: '2026-09-25',
} as Booking;

const listing = { checkInTime: '15:00', checkOutTime: '11:00' };

test('blocks the entry inventory until the scheduled arrival time', () => {
  assert.equal(getInventoryTiming(booking, listing, 'IN', new Date(2026, 8, 18, 14, 59)).isAvailable, false);
  assert.equal(getInventoryTiming(booking, listing, 'IN', new Date(2026, 8, 18, 15, 0)).isAvailable, true);
});

test('blocks the departure inventory until the scheduled departure time', () => {
  assert.equal(getInventoryTiming(booking, listing, 'OUT', new Date(2026, 8, 25, 10, 59)).isAvailable, false);
  assert.equal(getInventoryTiming(booking, listing, 'OUT', new Date(2026, 8, 25, 11, 0)).isAvailable, true);
});

test('identifies a departure before its scheduled time as early', () => {
  const timing = getInventoryTiming(booking, listing, 'OUT', new Date(2026, 8, 23, 12, 0));
  assert.equal(timing.isAvailable, false);
  assert.equal(timing.isEarlyDeparture, true);
});
