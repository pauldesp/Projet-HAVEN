import test from 'node:test';
import assert from 'node:assert/strict';
import { platformKpis } from './platformKpis';
import type { Booking, Listing } from '../types';

const listing = { id: 'l', title: 'Coloc', city: 'Niort', status: 'APPROVED', minStay: 4, rooms: [{ id: 'r1' }, { id: 'r2' }] } as unknown as Listing;
const booking = (over: Partial<Booking>) => ({ id: 'b', listingId: 'l', roomId: 'r1', tenantId: 't', ownerId: 'o', startDate: '2026-11-12', endDate: '2026-11-18', status: 'CONFIRMED', paymentStatus: 'PAID', createdAt: '', basePrice: 150, cleaningFee: 15, platformFee: 23, totalPrice: 188, ...over }) as Booking;

test('les indicateurs comptent occupation, annulations, récurrence et revenus par ville', () => {
  const kpis = platformKpis([booking({ id: 'a', seriesId: 's' }), booking({ id: 'b', status: 'CANCELLED' }), booking({ id: 'c', startDate: '2026-11-20', endDate: '2026-11-22' })], [listing], new Date('2026-11-11T10:00:00'));
  assert.equal(kpis.onlineRooms, 2);
  assert.equal(kpis.occupancyNext30, Math.round(8 / 60 * 100));
  assert.equal(kpis.cancellationRate, 33);
  assert.equal(kpis.recurringShare, 50);
  assert.equal(kpis.gapStays, 1);
  assert.deepEqual(kpis.byCity[0], { city: 'Niort', revenue: 376, commission: 46, stays: 2 });
});
