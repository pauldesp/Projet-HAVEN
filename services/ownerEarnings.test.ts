import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerEarningsSummary } from './ownerFinances';
import type { Booking, OwnerPayout } from '../types';

const now = new Date('2026-11-15T12:00:00');
const stay = (over: Partial<Booking>) => ({ id: 'b', listingId: 'l', roomId: 'r', tenantId: 't', ownerId: 'o', startDate: '2026-11-20', endDate: '2026-11-25', status: 'CONFIRMED', paymentStatus: 'PAID', createdAt: '2026-11-01T10:00:00Z', basePrice: 100, cleaningFee: 10, platformFee: 15, totalPrice: 125, ...over }) as Booking;
const payout = (over: Partial<OwnerPayout>) => ({ id: 'p', ownerId: 'o', amountCents: 5000, currency: 'EUR', provider: 'STRIPE', isTest: false, status: 'PAID', createdAt: '2026-11-10T10:00:00Z', paidAt: '2026-11-10T10:00:00Z', providerPayoutId: 'po_1', ...over }) as OwnerPayout;

test('les revenus du mois ne comptent que les virements réels versés ce mois-ci', () => {
  const summary = ownerEarningsSummary([], [payout({}), payout({ id: 'p2', providerPayoutId: 'po_2', paidAt: '2026-10-10T10:00:00Z' }), payout({ id: 'p3', isTest: true, providerPayoutId: 'po_3' })], now);
  assert.equal(summary.paidThisMonth, 50);
});

test('le montant à venir additionne la part propriétaire des séjours réservés, payés ou non', () => {
  const summary = ownerEarningsSummary([
    stay({ id: 'paid', paymentIsTest: true }),
    stay({ id: 'approved', status: 'APPROVED', paymentStatus: 'PENDING', approvedAt: '2026-11-15T10:00:00' }),
    stay({ id: 'arrived', startDate: '2026-11-14', checkInReportId: 'in' }),
    stay({ id: 'past', startDate: '2026-11-01', endDate: '2026-11-05' }),
    stay({ id: 'cancelled', status: 'CANCELLED' }),
  ], [payout({ id: 'p4', status: 'PROCESSING', paidAt: undefined, providerPayoutId: undefined })], now);
  assert.equal(summary.upcoming, 110 + 110 + 50);
  assert.equal(summary.upcomingSimulated, 110);
  assert.equal(summary.upcomingStays, 2);
});
