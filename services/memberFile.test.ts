import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMemberFile } from './memberFile';
import type { Booking } from '../types';

const booking = (over: Partial<Booking>) => ({ id: 'b', listingId: 'l', listingTitle: 'Coloc Martin', roomId: 'r', tenantId: 'u', ownerId: 'o', startDate: '2026-12-01', endDate: '2026-12-06', status: 'CONFIRMED', paymentStatus: 'PAID', createdAt: '2026-11-01T10:00:00Z', basePrice: 150, cleaningFee: 15, platformFee: 23, totalPrice: 188, ...over }) as Booking;

test('la fiche d’un membre réunit chiffres et chronologie, du plus récent au plus ancien', () => {
  const file = buildMemberFile({ userId: 'u',
    bookings: [booking({ id: 'b1' }), booking({ id: 'b2', createdAt: '2026-11-05T10:00:00Z', status: 'CANCELLED', cancellation: { cancelledAt: '2026-11-06T10:00:00Z', cancelledBy: 'TENANT', reason: 'Imprévu', refundPercent: 100, refundAmount: 188, refundStatus: 'COMPLETED' } }), booking({ id: 'b3', tenantId: 'x', ownerId: 'u' })],
    payments: [], payouts: [{ id: 'p', ownerId: 'u', amountCents: 16500, currency: 'EUR', provider: 'STRIPE', isTest: false, status: 'PAID', createdAt: '2026-11-07T10:00:00Z', paidAt: '2026-11-08T10:00:00Z' }],
    reports: [{ id: 'r', reporterId: 'u', targetId: 'l', targetType: 'LISTING', reason: 'INACCURATE', description: 'Photos anciennes', status: 'NEW', timestamp: '2026-11-09T10:00:00Z' }],
    incidents: [], reviews: [], mails: [], audit: [],
    notes: [{ id: 'n', userId: 'u', text: 'Appelé', authorId: 'a', authorName: 'Paul', createdAt: '2026-11-10T10:00:00Z' }] });
  assert.equal(file.counters.stays, 1);
  assert.equal(file.counters.ownerStays, 1);
  assert.equal(file.counters.cancelled, 1);
  assert.equal(file.counters.paidAsTenant, 188, 'net du remboursement de l’annulation');
  assert.equal(file.counters.earnedAsOwner, 165);
  assert.equal(file.counters.reportsMade, 1);
  assert.equal(file.events[0].label, 'Signalement envoyé');
  assert.ok(file.events.some(event => event.label === 'Annulation par le locataire'));
  assert.equal(file.notes[0].text, 'Appelé');
});
