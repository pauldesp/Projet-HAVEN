import test from 'node:test';
import assert from 'node:assert/strict';
import { installmentChargeDecision, installmentDeadline, installmentDueDates, installmentReminderAt, seriesStayDeadline, validateSeriesStays } from './recurringInstallments';
import type { Booking } from '../types';

const now = new Date('2026-11-06T10:00:00Z');
const later = (over: Partial<Booking> = {}) => ({ id: 'b2', listingId: 'l', roomId: 'r', tenantId: 't', ownerId: 'o', startDate: '2027-01-10', endDate: '2027-01-15', status: 'PENDING', paymentStatus: 'PENDING', createdAt: '2026-11-06T09:00:00Z', basePrice: 100, cleaningFee: 10, platformFee: 15, totalPrice: 125, seriesId: 's', seriesIndex: 1, seriesCount: 3, installmentDueDate: '2026-12-10', seriesActivatedAt: '2026-11-06T09:30:00Z', ...over }) as Booking;

test('le premier séjour est dû à la réservation, les suivants un mois avant leur arrivée', () => {
  assert.deepEqual(installmentDueDates([{ startDate: '2026-11-20' }, { startDate: '2026-11-30' }, { startDate: '2027-03-31' }], '2026-11-06'), ['2026-11-06', '2026-11-06', '2027-02-28']);
});

test('une série invalide est refusée', () => {
  const stay = (id: string, startDate: string, endDate: string) => ({ id, roomId: 'r', startDate, endDate });
  assert.equal(validateSeriesStays([stay('a', '2026-11-20', '2026-11-25')], now), 'Une série récurrente comporte au moins deux séjours.');
  assert.equal(validateSeriesStays([stay('a', '2026-11-20', '2026-11-25'), stay('b', '2026-11-24', '2026-11-28')], now), 'Les séjours de la série se chevauchent.');
  assert.equal(validateSeriesStays([stay('a', '2026-11-20', '2026-11-25'), stay('b', '2026-12-01', '2026-12-05')], now), null);
});

test('le délai de paiement dure 5 jours après l’échéance sans dépasser l’arrivée', () => {
  assert.equal(new Date(installmentDeadline(later())).toISOString(), '2026-12-15T22:00:00.000Z');
  assert.equal(new Date(installmentDeadline(later({ installmentDueDate: '2026-11-06', startDate: '2026-11-08' }))).toISOString(), '2026-11-08T06:00:00.000Z');
});

test('avant le premier paiement, les séjours suivants ne sont retenus que le temps du paiement', () => {
  assert.equal(seriesStayDeadline(later({ seriesActivatedAt: undefined })), Date.parse('2026-11-06T10:30:00Z'));
  assert.equal(seriesStayDeadline(later({ seriesIndex: 0 })), undefined);
  assert.equal(seriesStayDeadline(later({ paymentStatus: 'PAID', status: 'CONFIRMED' })), undefined);
});

test('le prélèvement attend son échéance, un paiement manuel en cours et le délai entre deux tentatives', () => {
  assert.equal(installmentChargeDecision(later(), now), 'WAIT');
  const due = new Date('2026-12-10T08:00:00Z');
  assert.equal(installmentChargeDecision(later(), due), 'CHARGE');
  assert.equal(installmentChargeDecision(later({ checkoutSessionId: 'cs_1', checkoutExpiresAt: '2026-12-10T09:00:00Z' }), due), 'WAIT');
  assert.equal(installmentChargeDecision(later({ nextInstallmentAttemptAt: '2026-12-11T08:00:00Z' }), due), 'WAIT');
  assert.equal(installmentChargeDecision(later({ seriesActivatedAt: undefined }), due), 'SKIP');
  assert.equal(installmentChargeDecision(later(), new Date('2026-12-16T08:00:00Z')), 'SKIP');
});

test('le rappel part 3 jours avant le prélèvement, sauf échéance imminente', () => {
  assert.equal(installmentReminderAt('2026-12-10', '2026-11-06T09:30:00Z'), '2026-12-07T09:00:00.000Z');
  assert.equal(installmentReminderAt('2026-11-08', '2026-11-06T09:30:00Z'), undefined);
});
