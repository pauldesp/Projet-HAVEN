import test from 'node:test';
import assert from 'node:assert/strict';
import { isGapStay, isRoomBookableForStay, requiredNightsForStay } from './gapStay';
import type { BookingAvailability, Listing, Room } from '../types';

const now = new Date('2026-11-06T10:00:00Z');
const room = { id: 'r1', name: 'Horizon', pricePerDay: 30 } as Room;
const listing = { id: 'l1', minStay: 4, rooms: [room] } as unknown as Listing;
const booking = (id: string, startDate: string, endDate: string, roomId = 'r1') => ({ id, bookingId: id, listingId: 'l1', roomId, startDate, endDate, status: 'CONFIRMED', updatedAt: '' }) as BookingAvailability;
// Gap of 2 nights (12 → 14) between two stays of the same room.
const around = [booking('a', '2026-11-08', '2026-11-12'), booking('b', '2026-11-14', '2026-11-20')];

test('un séjour qui remplit exactement un trou de 2 nuits est accepté malgré le minimum de 4', () => {
  assert.equal(requiredNightsForStay(room, listing, around, '2026-11-12', '2026-11-14', now), 2);
  assert.equal(isRoomBookableForStay(room, listing, around, '2026-11-12', '2026-11-14', now), true);
  assert.equal(isGapStay(room, listing, around, '2026-11-12', '2026-11-14', now), true);
});

test('un séjour court qui ne remplit pas tout le trou reste refusé', () => {
  const wide = [booking('a', '2026-11-08', '2026-11-12'), booking('b', '2026-11-15', '2026-11-20')];
  assert.equal(isRoomBookableForStay(room, listing, wide, '2026-11-12', '2026-11-14', now), false);
  assert.equal(isRoomBookableForStay(room, listing, wide, '2026-11-12', '2026-11-15', now), true, 'les 3 nuits du trou');
  assert.equal(isRoomBookableForStay(room, listing, [], '2026-11-12', '2026-11-14', now), false, 'sans voisins, le minimum s’applique');
});

test('le trou se lit chambre par chambre et tient compte des dates bloquées', () => {
  const otherRoom = [booking('a', '2026-11-08', '2026-11-12', 'r2'), booking('b', '2026-11-14', '2026-11-20', 'r2')];
  assert.equal(isRoomBookableForStay(room, listing, otherRoom, '2026-11-12', '2026-11-14', now), false);
  const blocked = { ...listing, blockedDates: ['2026-11-11', '2026-11-14'] } as Listing;
  assert.equal(isRoomBookableForStay(room, blocked, [], '2026-11-12', '2026-11-14', now), true);
});

test('une nuit isolée reste refusée sous le plancher de 2 nuits, et l’option peut être désactivée', () => {
  const single = [booking('a', '2026-11-08', '2026-11-12'), booking('b', '2026-11-13', '2026-11-20')];
  assert.equal(isRoomBookableForStay(room, listing, single, '2026-11-12', '2026-11-13', now), false);
  assert.equal(isRoomBookableForStay(room, { ...listing, allowGapStays: false } as Listing, around, '2026-11-12', '2026-11-14', now), false);
});

test('le dernier moment compte : de aujourd’hui jusqu’à la prochaine réservation', () => {
  const next = [booking('b', '2026-11-08', '2026-11-20')];
  assert.equal(isRoomBookableForStay(room, listing, next, '2026-11-06', '2026-11-08', now), true);
  assert.equal(isRoomBookableForStay(room, listing, next, '2026-11-07', '2026-11-08', now), false, '1 nuit, sous le plancher');
});

test('sans dates choisies, une chambre libre reste proposée', () => {
  assert.equal(isRoomBookableForStay(room, listing, around, '', '', now), true);
});
