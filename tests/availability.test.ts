import assert from 'node:assert/strict';
import test from 'node:test';
import { isRoomAvailableForStay, listingHasAvailableRoom } from '../services/availability';
import { readFileSync } from 'node:fs';

const listing = { id: 'listing-1', blockedDates: [] };
const room = { id: 'room-1', isAvailable: true, blockedDates: [] } as any;
const booking = { id: 'booking-1', bookingId: 'booking-1', listingId: 'listing-1', roomId: 'room-1', startDate: '2026-10-20', endDate: '2026-10-24', status: 'CONFIRMED', updatedAt: '' } as const;

test('a room is unavailable when a booking overlaps any requested night', () => {
  assert.equal(isRoomAvailableForStay(room, listing, [booking], '2026-10-17', '2026-10-24'), false);
  assert.equal(isRoomAvailableForStay(room, listing, [booking], '2026-10-24', '2026-10-27'), true);
});

test('room and listing blocks prevent a stay, while cancelled bookings do not', () => {
  assert.equal(isRoomAvailableForStay({ ...room, blockedDates: ['2026-10-19'] }, listing, [], '2026-10-17', '2026-10-20'), false);
  assert.equal(isRoomAvailableForStay(room, { ...listing, blockedDates: ['2026-10-19'] }, [], '2026-10-17', '2026-10-20'), false);
  assert.equal(isRoomAvailableForStay(room, listing, [{ ...booking, status: 'CANCELLED' }], '2026-10-20', '2026-10-24'), true);
});

test('a listing is omitted when every room is unavailable for the requested stay', () => {
  const rooms = [room, { ...room, id: 'room-2', isAvailable: false }];
  assert.equal(listingHasAvailableRoom({ ...listing, rooms }, [booking], '2026-10-20', '2026-10-24'), false);
  assert.equal(listingHasAvailableRoom({ ...listing, rooms }, [booking], '2026-10-24', '2026-10-27'), true);
});

test('booking status updates keep availability range-based', () => {
  const api = readFileSync(new URL('../services/api.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(api, /isAvailable:\s*false/);
});
