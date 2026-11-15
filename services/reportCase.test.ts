import test from 'node:test';
import assert from 'node:assert/strict';
import type { Booking, InventoryReport, Report } from '../types';
import { caseGuidance, pickPreviousStay } from './reportCase';
import { DAMAGE_DEPOSIT_POLICY } from './damageDeposit';

const stay = (id: string, startDate: string, endDate: string, changes: Partial<Booking> = {}) => ({
  id, listingId: 'l1', roomId: 'r1', tenantId: `t-${id}`, ownerId: 'o1', startDate, endDate, status: 'COMPLETED', paymentStatus: 'PAID',
  basePrice: 100, cleaningFee: 0, platformFee: 15, totalPrice: 115, createdAt: '2026-10-01T00:00:00.000Z', ...changes,
}) as Booking;
const report = { id: 'rep1', reporterId: 't-cur', targetId: 'l1', targetType: 'LISTING', reason: 'OTHER', description: 'Espaces communs : Pas propre', status: 'NEW', timestamp: '2026-11-15T00:48:00.000Z', supportCategory: 'État du logement - Ménage non fait' } as Report;
const current = stay('cur', '2026-11-15', '2026-11-19', { status: 'CONFIRMED' });

test('the previous stay is the last paid one in the same room that ended by the arrival', () => {
  const bookings = [
    stay('old', '2026-10-01', '2026-10-10'),
    stay('prev', '2026-11-05', '2026-11-15'),
    stay('otherRoom', '2026-11-10', '2026-11-14', { roomId: 'r2' }),
    stay('cancelled', '2026-11-12', '2026-11-14', { status: 'CANCELLED' }),
    stay('unpaid', '2026-11-12', '2026-11-14', { paymentStatus: 'PENDING' }),
    stay('later', '2026-11-20', '2026-11-25'),
    current,
  ];
  assert.equal(pickPreviousStay(bookings, current)?.id, 'prev');
  assert.equal(pickPreviousStay([current], current), null);
});

test('without a previous stay, the room preparation was the owner’s', () => {
  const guidance = caseGuidance({ report, stay: { booking: current, tenant: null, checkIn: null, checkOut: null }, previousStay: null, settlement: null, today: '2026-11-15' });
  assert.ok(guidance.some(item => item.text.includes('relevait du propriétaire')));
});

test('a previous tenant without check-out, still within the deposit window, can be charged through Haven', () => {
  const previous = stay('prev', '2026-11-05', '2026-11-15', { depositConsent: { version: DAMAGE_DEPOSIT_POLICY.version, text: '', amountCents: 30000, acceptedAt: '' } });
  const guidance = caseGuidance({ report, stay: { booking: current, tenant: null, checkIn: null, checkOut: null },
    previousStay: { booking: previous, tenant: null, checkIn: null, checkOut: null, damageClaim: null }, settlement: { state: 'WAITING_ARRIVAL', amountCents: 10000, adminHold: false }, today: '2026-11-15' });
  const texts = guidance.map(item => item.text).join('\n');
  assert.match(texts, /jour même de l’arrivée/);
  assert.match(texts, /pas fait d’état des lieux de sortie/);
  assert.match(texts, /jusqu’au 22 novembre inclus/);
  assert.match(texts, /ménage hebdomadaire/);
  assert.match(texts, /bloquer/);
});

test('a certified check-out contradicting the report is flagged, and a paid-out owner share points to a refund', () => {
  const checklist = Object.fromEntries(['kitchen_clean', 'kitchen_appliances', 'food_removed', 'common_clean', 'bathroom_clean', 'waste_removed'].map(key => [key, true]));
  const checkOut = { id: 'inv', type: 'OUT', comments: JSON.stringify({ checklist }), date: '2026-11-15T09:00:00.000Z' } as unknown as InventoryReport;
  const previous = stay('prev', '2026-11-05', '2026-11-12');
  const guidance = caseGuidance({ report, stay: { booking: current, tenant: null, checkIn: null, checkOut: null },
    previousStay: { booking: previous, tenant: null, checkIn: null, checkOut, damageClaim: null }, settlement: { state: 'TRANSFERRED', amountCents: 10000, adminHold: false }, today: '2026-11-15' });
  const texts = guidance.map(item => item.text).join('\n');
  assert.match(texts, /3 jours entre le départ/);
  assert.match(texts, /a certifié le ménage/);
  assert.match(texts, /réservé avant la caution/);
  assert.match(texts, /déjà partie/);
});
