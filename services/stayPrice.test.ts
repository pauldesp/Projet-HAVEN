import test from 'node:test';
import assert from 'node:assert/strict';
import type { Listing, BookingAvailability } from '../types';
import { cheapestStayPrice } from './stayPrice';

const listing = { id: 'home', cleaningFee: 15, rooms: [{ id: 'cheap', pricePerDay: 20 }, { id: 'other', pricePerDay: 22 }] } as Listing;
const booked = [{ listingId: 'home', roomId: 'cheap', startDate: '2026-10-26', endDate: '2026-10-31', status: 'CONFIRMED' }] as BookingAvailability[];
test('search stay total includes the same fixed cleaning and rounded service fee as checkout', () => {
  assert.deepEqual(cheapestStayPrice(listing, [], '2026-10-26', '2026-10-31'), { nights: 5, nightlyPrice: 20, basePrice: 100, cleaningFee: 15, platformFee: 15, total: 130 });
  assert.equal(cheapestStayPrice(listing, booked, '2026-10-26', '2026-10-31')?.total, 142);
});
test('unavailable rooms never provide the advertised starting price', () => {
  const blocked = { ...listing, rooms: listing.rooms.map(room => ({ ...room, blockedDates: ['2026-10-27'] })) };
  assert.equal(cheapestStayPrice(blocked, [], '2026-10-26', '2026-10-31'), null);
  assert.equal(cheapestStayPrice(listing, [], '', ''), null);
  assert.equal(cheapestStayPrice(listing, booked, '2026-10-31', '2026-11-05')?.nightlyPrice, 20);
});
