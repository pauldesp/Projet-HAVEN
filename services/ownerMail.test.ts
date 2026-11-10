import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerMailDisposition, ownerMailId, ownerMailJob, ownerMailValues, ownerNotificationEmail, type OwnerMailData } from './ownerMail';
import type { Booking } from '../types';

const at = '2026-11-10T10:00:00.000Z';
const start = '2026-01-01T00:00:00Z';
const now = Date.parse(at) + 60_000;
const booking = { id: 'b1', listingId: 'l', listingTitle: 'Coloc Martin', roomId: 'r', roomName: 'Horizon', tenantId: 't', ownerId: 'o', startDate: '2026-12-01', endDate: '2026-12-06', status: 'CONFIRMED', paymentStatus: 'PAID', createdAt: at, basePrice: 150, cleaningFee: 15, platformFee: 23, totalPrice: 188, checkInTime: '15:00', checkOutTime: '11:00' } as Booking;
const data: OwnerMailData = { owner: { firstName: 'Paul', email: 'owner@example.test' }, tenant: { firstName: 'Camille', lastName: 'dupont' }, booking };

test('le propriétaire reçoit la nouvelle réservation avec sa part, sans le nom complet du locataire', () => {
  const job = ownerMailJob('OWNER_BOOKING', 'o', at, { bookingId: 'b1' });
  assert.equal(ownerMailId(job), 'b1-OWNER_BOOKING');
  assert.equal(ownerMailDisposition(job, data, start, now), 'SEND');
  const values = ownerMailValues(job, data);
  assert.equal(values.LOCATAIRE, 'Camille D.');
  assert.match(values.MONTANT_PROPRIETAIRE, /165,00/);
  assert.match(ownerNotificationEmail(job, data, 'https://haven.test').text, /Mon espace propriétaire : https:\/\/haven\.test\/#\/owner\/dashboard/);
});

test('un mail propriétaire ne part que pour son propre logement et un événement toujours valable', () => {
  assert.equal(ownerMailDisposition(ownerMailJob('OWNER_BOOKING', 'autre', at, { bookingId: 'b1' }), data, start, now), 'CANCELLED');
  assert.equal(ownerMailDisposition(ownerMailJob('OWNER_CANCELLED', 'o', at, { bookingId: 'b1' }), data, start, now), 'CANCELLED', 'réservation pas annulée');
  assert.equal(ownerMailDisposition(ownerMailJob('OWNER_BOOKING', 'o', at, { bookingId: 'b1' }), data, start, now + 8 * 86400_000), 'EXPIRED');
  assert.equal(ownerMailDisposition(ownerMailJob('OWNER_BOOKING', 'o', at, { bookingId: 'b1' }), { ...data, owner: {} }, start, now), 'CANCELLED', 'sans e-mail');
});

test('l’annulation explique l’initiative et l’absence de versement', () => {
  const cancelled = { ...booking, status: 'CANCELLED', cancellation: { cancelledAt: at, cancelledBy: 'TENANT', reason: 'Changement de programme', refundPercent: 50, refundAmount: 94, refundStatus: 'COMPLETED' } } as Booking;
  const values = ownerMailValues(ownerMailJob('OWNER_CANCELLED', 'o', at, { bookingId: 'b1' }), { ...data, booking: cancelled });
  assert.equal(values.INITIATIVE_ANNULATION, 'à l’initiative du locataire');
  assert.match(values.INFORMATION_VERSEMENT, /remboursé à 50 %.*Aucun versement/);
  const unpaid = { ...booking, status: 'CANCELLED', paymentStatus: 'PENDING', unpaidCancelledAt: at } as Booking;
  assert.equal(ownerMailValues(ownerMailJob('OWNER_CANCELLED', 'o', at, { bookingId: 'b1' }), { ...data, booking: unpaid }).INITIATIVE_ANNULATION, 'faute de paiement du locataire');
});

test('le virement n’est annoncé qu’une fois versé', () => {
  const payout = { id: 'p1', ownerId: 'o', amountCents: 32000, currency: 'EUR', provider: 'STRIPE', isTest: false, status: 'PAID', createdAt: at, paidAt: at, providerPayoutId: 'po_1' } as const;
  const job = ownerMailJob('OWNER_PAYOUT', 'o', at, { payoutId: 'p1' });
  assert.equal(ownerMailDisposition(job, { ...data, payout }, start, now), 'SEND');
  assert.equal(ownerMailDisposition(job, { ...data, payout: { ...payout, status: 'PENDING' } }, start, now), 'CANCELLED');
  assert.match(ownerMailValues(job, { ...data, payout }).MONTANT_VIREMENT, /320,00/);
});
