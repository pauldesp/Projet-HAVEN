import test from 'node:test';
import assert from 'node:assert/strict';
import type { Listing, BookingAvailability } from '../types';
import { parseRecurringPeriods, matchRecurringStays, completionForPeriod, recurringScore, recurringListingLink } from './recurringSearch';

const now = new Date('2026-11-04T12:00:00Z');
const periods = [{ start: '2026-11-08', end: '2026-11-13' }, { start: '2026-11-22', end: '2026-11-27' }];
const listing = { id: 'a', status: 'APPROVED', city: 'La Rochelle', minStay: 4, cleaningFee: 15, rating: 4.8, coordinates: { lat: 46.16, lng: -1.15 }, rooms: [
  { id: 'cheap', pricePerDay: 20, hasDesk: false }, { id: 'desk', pricePerDay: 30, hasDesk: true },
] } as Listing;
const block = (roomId: string, start = periods[1].start, end = periods[1].end) => ({ id: roomId, listingId: 'a', roomId, startDate: start, endDate: end, status: 'CONFIRMED' }) as BookingAvailability;

test('recurring query validates every date, sorts periods and rejects overlaps and malformed input', () => {
  const read = (data: unknown) => parseRecurringPeriods(new URLSearchParams({ periods: JSON.stringify(data) }), now);
  assert.deepEqual(read([...periods].reverse()), periods);
  assert.deepEqual(read([periods[0], periods[0]]), []);
  assert.deepEqual(read([periods[0]]), []);
  assert.deepEqual(read([periods[0], { start: '2027-02-30', end: '2027-03-05' }]), []);
  assert.deepEqual(read([periods[0], { start: '2026-01-01', end: '2026-01-07' }]), []);
  assert.deepEqual(parseRecurringPeriods(new URLSearchParams({ periods: 'bad' }), now), []);
});

test('partial coverage prices only available periods, with one cleaning contribution per stay', () => {
  const match = matchRecurringStays(listing, [block('cheap'), block('desk')], periods, false, [], now);
  assert.equal(match.availableCount, 1);
  assert.equal(match.total, 130);
  assert.equal(match.average, 130);
  assert.equal(match.periods[1].total, null);
  assert.deepEqual(match.commonRoomIds, ['cheap', 'desk']);
  assert.equal(matchRecurringStays(listing, [], periods, false, [], now).total, 260);
});

test('room filters apply to the available room, not another occupied room', () => {
  const match = matchRecurringStays(listing, [block('desk')], periods, false, ['hasDesk'], now);
  assert.equal(match.availableCount, 1);
  assert.equal(match.total, 188);
  assert.equal(match.periods[0].roomIds.includes('cheap'), false);
  assert.equal(matchRecurringStays({ ...listing, minStay: 6 }, [], periods, false, [], now).availableCount, 0);
});

test('November 27 is available room by room; short stays report the minimum duration instead of occupancy', () => {
  const requested = [{ start: '2026-11-27', end: '2026-11-30' }, { start: '2026-12-12', end: '2026-12-17' }];
  const short = matchRecurringStays(listing, [], requested, true, [], now);
  assert.equal(short.periods[0].minimumNightsRequired, 4);
  assert.equal(short.periods[0].stay, null);
  assert.equal(short.periods[1].roomIds.length, 2);
  const valid = [{ start: '2026-11-27', end: '2026-12-01' }, requested[1]];
  assert.equal(matchRecurringStays(listing, [], valid, false, [], now).availableCount, 2);
  const occupied = [block('cheap', '2026-11-27', '2026-12-01')];
  assert.deepEqual(matchRecurringStays(listing, occupied, valid, false, [], now).periods[0].roomIds, ['desk']);
  assert.equal(matchRecurringStays({ ...listing, blockedDates: ['2026-11-28'] }, [], valid, false, [], now).periods[0].stay, null);
  assert.deepEqual(matchRecurringStays({ ...listing, rooms: listing.rooms.map(room => room.id === 'cheap' ? { ...room, blockedDates: ['2026-11-28'] } : room) }, [], valid, false, [], now).periods[0].roomIds, ['desk']);
});

test('common room continuity is distinct from having some room available at every stay', () => {
  const match = matchRecurringStays(listing, [block('cheap', periods[0].start, periods[0].end), block('desk')], periods, false, [], now);
  assert.equal(match.availableCount, 2);
  assert.deepEqual(match.commonRoomIds, []);
  assert.equal(match.total, 318);
});

test('flexibility never silently changes exact dates and shifts both dates by only one day', () => {
  const blocked = [block('cheap', '2026-11-12', '2026-11-13'), block('desk', '2026-11-12', '2026-11-13')];
  assert.equal(matchRecurringStays(listing, blocked, periods, false, [], now).availableCount, 1);
  const flexible = matchRecurringStays(listing, blocked, periods, true, [], now);
  assert.equal(flexible.availableCount, 2);
  assert.equal(flexible.periods[0].offset, -1);
  assert.deepEqual(flexible.periods[0].requested, periods[0]);
  assert.deepEqual(flexible.periods[0].stay, { start: '2026-11-07', end: '2026-11-12' });
  const adjacent = [{ start: '2026-11-03', end: '2026-11-08' }, periods[0]];
  assert.equal(matchRecurringStays(listing, blocked, adjacent, true, [], new Date('2026-11-01T12:00:00Z')).periods[1].stay, null);
});

test('complements use real exact availability, publication status and geographic distance', () => {
  const other = { ...listing, id: 'b', title: 'Maison du Port', coordinates: { lat: 46.161, lng: -1.15 } };
  assert.equal(completionForPeriod(listing, [listing, { ...other, status: 'PENDING' } as Listing], [], periods[0], [], now), undefined);
  assert.equal(completionForPeriod(listing, [other], [], periods[0], [], now)?.listing.id, 'b');
  assert.equal(completionForPeriod(listing, [{ ...other, coordinates: { lat: 48.85, lng: 2.35 } }], [], periods[0], [], now), undefined);
  assert.equal(completionForPeriod(listing, [other], [block('cheap', periods[0].start, periods[0].end), block('desk', periods[0].start, periods[0].end)].map(item => ({ ...item, listingId: 'b' })), periods[0], [], now), undefined);
});

test('best choice can favour a nearby well-rated partial match over a distant complete match', () => {
  const partial = matchRecurringStays(listing, [block('cheap'), block('desk')], periods, false, [], now);
  const full = matchRecurringStays(listing, [], periods, false, [], now);
  assert.ok(recurringScore(listing, partial, 1) > recurringScore({ ...listing, rating: 3 }, full, 40));
  const link = recurringListingLink('a', periods[1], periods);
  const params = new URLSearchParams(link.split('?')[1]);
  assert.equal(params.get('start'), periods[1].start);
  assert.deepEqual(parseRecurringPeriods(params, now), periods);
});
