import test from 'node:test';
import assert from 'node:assert/strict';
import type { Booking, Listing, InventoryReport } from '../types';
import { assertBookingPayable, bookingCategory, bookingDeadline, isBookingExpired, paymentDisposition, prepareInventoryReport } from './bookingLifecycle';
import { isRoomAvailableForStay } from './availability';

const created = '2026-11-01T12:00:00.000Z';
const base = { id: 'b-test', tenantId: 'tenant', ownerId: 'owner', listingId: 'listing', roomId: 'room', roomName: 'Chambre', startDate: '2026-11-07', endDate: '2026-11-14', status: 'PENDING', bookingMode: 'INSTANT', paymentStatus: 'PENDING', createdAt: created, totalPrice: 161, basePrice: 140, cleaningFee: 0, platformFee: 21, checkInTime: '15:00', checkOutTime: '11:00' } as Booking;
const listing = { id: 'listing', checkInTime: '17:00', checkOutTime: '09:00', rooms: [{ id: 'room', pricePerDay: 20 }] } as Listing;
const report = (booking: Booking, type: 'IN' | 'OUT'): InventoryReport => ({ id: `inv_${type}`, bookingId: booking.id, tenantId: booking.tenantId, ownerId: booking.ownerId, type, date: created, status: 'COMPLETED', identityValidated: true, items: [], comments: '{}', signature: 'USER_SIGNED', roomRating: 5, houseRating: 5, cleanlinessRating: 5 });
const availability = (booking: Booking) => [{ ...booking, bookingId: booking.id, updatedAt: created }];

test('booking → direct payment → confirmation → arrival → departure releases the room', () => {
  assert.doesNotThrow(() => assertBookingPayable(base, 'tenant', Date.parse(created)));
  assert.equal(isRoomAvailableForStay(listing.rooms[0], listing, availability(base), base.startDate, base.endDate), false);
  const approved = { ...base };
  assert.equal(bookingDeadline(approved), Date.parse(created) + 30 * 60_000);
  const paid = { ...approved, status: 'CONFIRMED', paymentStatus: 'PAID', stripeSessionId: 'checkout' } as Booking;
  assert.equal(paymentDisposition({ ...approved, stripeSessionId: 'checkout' }, 'checkout', 16100), 'CONFIRM');
  assert.equal(bookingCategory(paid, new Date(2026, 10, 7, 15)), 'CURRENT');
  const entry = prepareInventoryReport(paid, listing, 'tenant', report(paid, 'IN'), new Date(2026, 10, 7, 15));
  const checkedIn = { ...paid, checkInReportId: entry.id };
  const exit = prepareInventoryReport(checkedIn, listing, 'tenant', report(checkedIn, 'OUT'), new Date(2026, 10, 14, 11));
  const completed = { ...checkedIn, status: 'COMPLETED', checkOutReportId: exit.id } as Booking;
  assert.equal(bookingCategory(completed), 'PAST');
  assert.equal(isRoomAvailableForStay(listing.rooms[0], listing, availability(completed), base.startDate, base.endDate), true);
});

test('instant booking can be paid without an owner decision, but not by another member', () => {
  const instant = { ...base, bookingMode: 'INSTANT' as const };
  assert.doesNotThrow(() => assertBookingPayable(instant, 'tenant', Date.parse(created)));
  assert.throws(() => assertBookingPayable(instant, 'other', Date.parse(created)), /locataire/);

});

test('legacy manual requests can also be paid immediately, with no owner approval', () => {
  const legacy = { ...base, bookingMode: 'MANUAL' as const };
  assert.doesNotThrow(() => assertBookingPayable(legacy, 'tenant', Date.parse(created)));
  assert.equal(bookingDeadline(legacy), Date.parse(created) + 30 * 60_000);
  assert.equal(isBookingExpired(legacy, Date.parse(created) + 30 * 60_000), true);
  assert.throws(() => assertBookingPayable(legacy, 'tenant', Date.parse(created) + 30 * 60_000), /délai/);
  assert.throws(() => assertBookingPayable({ ...legacy, status: 'CANCELLED' }, 'tenant', Date.parse(created)));
});

test('webhook retries are idempotent and a cancelled reservation or wrong price/session cannot be confirmed', () => {
  const booking = { ...base, status: 'APPROVED' as const, stripeSessionId: 'checkout' };
  assert.equal(paymentDisposition(booking, 'checkout', 16100), 'CONFIRM');
  assert.equal(paymentDisposition({ ...booking, status: 'CONFIRMED', paymentStatus: 'PAID' }, 'checkout', 16100), 'DUPLICATE');
  assert.equal(paymentDisposition({ ...booking, status: 'CANCELLED' }, 'checkout', 16100), 'REFUND');
  assert.equal(paymentDisposition(booking, 'wrong', 16100), 'REFUND');
  assert.equal(paymentDisposition(booking, 'checkout', 1), 'REFUND');
});

test('arrival/departure require confirmed payment, the right tenant, the contractual time and no duplicate report', () => {
  assert.throws(() => prepareInventoryReport(base, listing, 'tenant', report(base, 'IN')), /paiement/);
  const paid = { ...base, status: 'CONFIRMED', paymentStatus: 'PAID' } as Booking;
  assert.throws(() => prepareInventoryReport(paid, listing, 'owner', report(paid, 'IN')), /locataire/);
  assert.throws(() => prepareInventoryReport(paid, listing, 'tenant', report(paid, 'IN'), new Date(2026, 10, 7, 14, 59)), /disponible/);
  assert.throws(() => prepareInventoryReport(paid, listing, 'tenant', report(paid, 'OUT'), new Date(2026, 10, 14, 11)), /entrée/);
  assert.throws(() => prepareInventoryReport({ ...paid, checkInReportId: 'existing' }, listing, 'tenant', report(paid, 'IN')), /déjà/);
  assert.throws(() => prepareInventoryReport(paid, listing, 'tenant', { ...report(paid, 'IN'), tenantId: 'forged' }), /participants/);
});

test('early departure requires an explicit reason; checkout closes after departure day', () => {
  const paid = { ...base, status: 'CONFIRMED', paymentStatus: 'PAID', checkInReportId: 'entry' } as Booking;
  const now = new Date(2026, 10, 10, 11);
  assert.throws(() => prepareInventoryReport(paid, listing, 'tenant', report(paid, 'OUT'), now), /disponible/);
  const early = prepareInventoryReport(paid, listing, 'tenant', { ...report(paid, 'OUT'), isEarlyDeparture: true, earlyDepartureReason: 'Départ anticipé pour raison personnelle' }, now);
  assert.equal(early.isEarlyDeparture, true);
  assert.equal(bookingCategory(paid, new Date(2026, 10, 14, 11)), 'CURRENT');
  assert.equal(bookingCategory(paid, new Date(2026, 10, 15, 11)), 'PAST');
});

test('abandoned instant checkout releases its hold after 30 minutes', () => {
  const instant = { ...base, bookingMode: 'INSTANT' as const };
  assert.equal(isBookingExpired(instant, Date.parse(created) + 30 * 60_000 - 1), false);
  assert.equal(isBookingExpired(instant, Date.parse(created) + 30 * 60_000), true);
});

test('long-past confirmed stays without checkout reports are history, without faking completed status', () => {
  const old = { ...base, startDate: '2026-04-04', endDate: '2026-04-11', status: 'CONFIRMED', paymentStatus: 'PAID' } as Booking;
  assert.equal(bookingCategory(old, new Date('2026-10-19T20:00:00Z')), 'PAST');
  assert.equal(old.status, 'CONFIRMED');
  assert.equal(bookingCategory({ ...old, endDate: '2026-10-19' }, new Date('2026-10-19T20:00:00Z')), 'CURRENT');
});
test('server refuses late entry/exit and forged early departure outside the stay', () => {
  const paid = { ...base, status: 'CONFIRMED', paymentStatus: 'PAID' } as Booking;
  assert.throws(() => prepareInventoryReport(paid, listing, 'tenant', report(paid, 'IN'), new Date(2026, 10, 8, 10)), /dépassée/);
  const checkedIn = { ...paid, checkInReportId: 'entry' };
  const forced = { ...report(checkedIn, 'OUT'), isEarlyDeparture: true, earlyDepartureReason: 'Départ anticipé pour motif personnel' };
  assert.throws(() => prepareInventoryReport(checkedIn, listing, 'tenant', forced, new Date(2026, 10, 15, 10)), /dépassée/);
  assert.throws(() => prepareInventoryReport(checkedIn, listing, 'tenant', forced, new Date(2026, 10, 6, 10)), /disponible/);
  assert.doesNotThrow(() => prepareInventoryReport(checkedIn, listing, 'tenant', report(checkedIn, 'OUT'), new Date(2026, 10, 14, 8)));
});
