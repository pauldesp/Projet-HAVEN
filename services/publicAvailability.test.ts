import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAvailability } from './publicAvailability';
import { publicAvailabilityItem, isRoomAvailableForStay } from './availability';
import type { Room } from '../types';

const occupied = { listingId: 'listing', roomId: 'room', startDate: '2026-10-21', endDate: '2026-10-28', status: 'CONFIRMED', tenantId: 'private-user', email: 'private@example.test', totalPrice: 200 };
test('the public calendar strips all participant, contact and financial information', () => {
  const result = publicAvailabilityItem('calendar', occupied)!;
  assert.deepEqual(Object.keys(result).sort(), ['id', 'bookingId', 'listingId', 'roomId', 'startDate', 'endDate', 'status', 'updatedAt'].sort());
  assert.equal(publicAvailabilityItem('cancelled', { ...occupied, status: 'CANCELLED' }), null);
  assert.equal(publicAvailabilityItem('malformed', { status: 'CONFIRMED' }), null);
});
test('server calendar data blocks the occupied room but leaves another room and checkout-day reuse available', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), '/api/availability?listingId=listing');
    assert.equal(options?.cache, 'no-store');
    return new Response(JSON.stringify({ availability: [publicAvailabilityItem('calendar', occupied)] }), { status: 200 });
  };
  try {
    const calendar = await loadAvailability('listing');
    assert.equal(isRoomAvailableForStay({ id: 'room' } as Room, { id: 'listing' }, calendar, '2026-10-22', '2026-10-26'), false);
    assert.equal(isRoomAvailableForStay({ id: 'other-room' } as Room, { id: 'listing' }, calendar, '2026-10-22', '2026-10-26'), true);
    assert.equal(isRoomAvailableForStay({ id: 'room' } as Room, { id: 'listing' }, calendar, '2026-10-28', '2026-10-30'), true);
  } finally { globalThis.fetch = original; }
});
test('unavailable or malformed calendars fail instead of returning a misleading empty calendar', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('{}', { status: 503 });
    await assert.rejects(loadAvailability('listing'), /vérifier/);
    globalThis.fetch = async () => new Response('{}', { status: 200 });
    await assert.rejects(loadAvailability('listing'), /indisponibles/);
  } finally { globalThis.fetch = original; }
});
