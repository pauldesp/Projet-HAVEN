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

test('departure inventory is available throughout departure day, including before checkout time', () => {
  assert.equal(getInventoryTiming(booking, listing, 'OUT', new Date(2026, 8, 25, 10, 59)).isAvailable, true);
  assert.equal(getInventoryTiming(booking, listing, 'OUT', new Date(2026, 8, 25, 11, 0)).isAvailable, true);
});

test('identifies a departure before its scheduled time as early', () => {
  const timing = getInventoryTiming(booking, listing, 'OUT', new Date(2026, 8, 23, 12, 0));
  assert.equal(timing.isAvailable, false);
  assert.equal(timing.isEarlyDeparture, true);
});

test('entry and exit close after their own local calendar day', () => {
  assert.equal(getInventoryTiming(booking, listing, 'IN', new Date('2026-09-18T21:59:59Z')).isAvailable, true);
  assert.equal(getInventoryTiming(booking, listing, 'IN', new Date('2026-09-18T22:00:00Z')).isAvailable, false);
  assert.equal(getInventoryTiming(booking, listing, 'OUT', new Date('2026-09-25T21:59:59Z')).isAvailable, true);
  const late = getInventoryTiming(booking, listing, 'OUT', new Date('2026-09-25T22:00:00Z'));
  assert.equal(late.isAvailable, false);
  assert.equal(late.isEarlyDeparture, false);
  assert.equal(late.isExpired, true);
});
test('early departure is impossible before arrival and stays bounded by the stay', () => {
  assert.equal(getInventoryTiming(booking, listing, 'OUT', new Date('2026-09-17T16:00:00Z')).isEarlyDeparture, false);
  assert.equal(getInventoryTiming(booking, listing, 'OUT', new Date('2026-09-18T12:59:00Z')).isEarlyDeparture, false);
  assert.equal(getInventoryTiming(booking, listing, 'OUT', new Date('2026-09-18T13:00:00Z')).isEarlyDeparture, true);
});
test('the property timezone determines the inventory day, not the browser timezone', () => {
  const overseas = { ...booking, timeZone: 'America/Marigot' };
  assert.equal(getInventoryTiming(overseas, listing, 'IN', new Date('2026-09-19T02:00:00Z')).isAvailable, true);
  assert.equal(getInventoryTiming(overseas, listing, 'IN', new Date('2026-09-19T04:00:00Z')).isAvailable, false);
});
