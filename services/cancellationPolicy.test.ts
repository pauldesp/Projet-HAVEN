import assert from 'node:assert/strict';
import test from 'node:test';
import { getCancellationTerms } from './cancellationPolicy';

// 180 € stay + 30 € cleaning + 30 € Haven service fee.
const booking = { status: 'CONFIRMED' as const, startDate: '2026-11-01', totalPrice: 240, platformFee: 30, paymentStatus: 'PAID' as const };

test('tenant tiers: everything back beyond 14 days, half of stay and cleaning from 14 to 8 days, nothing below', () => {
  assert.equal(getCancellationTerms(booking, 'TENANT', '2026-10-01').refundAmount, 240);
  assert.equal(getCancellationTerms(booking, 'TENANT', '2026-10-17').refundAmount, 240, '15 jours');
  const half = getCancellationTerms(booking, 'TENANT', '2026-10-18');
  assert.equal(half.daysBeforeArrival, 14);
  assert.equal(half.refundAmount, 105, '50 % de 180 + 30, frais de service conservés');
  assert.equal(half.serviceFeeKept, 30);
  assert.equal(getCancellationTerms(booking, 'TENANT', '2026-10-24').refundAmount, 105, '8 jours');
  assert.equal(getCancellationTerms(booking, 'TENANT', '2026-10-25').refundAmount, 0, '7 jours');
  assert.equal(getCancellationTerms(booking, 'TENANT', '2026-10-31').refundAmount, 0, 'la veille');
});

test('a half refund is rounded to the cent and never exceeds what was paid', () => {
  const odd = { ...booking, totalPrice: 100.01, platformFee: 13.05 };
  assert.equal(getCancellationTerms(odd, 'TENANT', '2026-10-20').refundAmount, 43.48);
  const noFee = { status: 'CONFIRMED' as const, startDate: '2026-11-01', totalPrice: 240, paymentStatus: 'PAID' as const };
  assert.equal(getCancellationTerms(noFee, 'TENANT', '2026-10-20').refundAmount, 120);
});

test('a later stay of a series not charged yet is always cancelled free of charge by the tenant', () => {
  const scheduled = { ...booking, status: 'PENDING' as const, paymentStatus: 'PENDING' as const, seriesScheduled: true };
  for (const today of ['2026-09-01', '2026-10-20', '2026-10-30']) {
    const terms = getCancellationTerms(scheduled, 'TENANT', today);
    assert.equal(terms.canCancel, true);
    assert.equal(terms.label, 'Annulation sans frais');
  }
});

test('an owner cancels alone only 30 days or more before arrival, with a full refund', () => {
  const terms = getCancellationTerms(booking, 'OWNER', '2026-10-01');
  assert.equal(terms.canCancel, true);
  assert.equal(terms.refundPercent, 100);
  assert.equal(terms.refundAmount, 240);
  assert.equal(getCancellationTerms(booking, 'OWNER', '2026-10-02').canCancel, true, '30 jours pile'); assert.equal(getCancellationTerms(booking, 'OWNER', '2026-10-03').canCancel, false);
  assert.equal(getCancellationTerms(booking, 'OWNER', '2026-10-30').canCancel, false);
});

test('the same owner limit protects a reserved later stay of a recurring series', () => {
  const scheduled = { ...booking, status: 'PENDING' as const, paymentStatus: 'PENDING' as const, seriesScheduled: true };
  assert.equal(getCancellationTerms(scheduled, 'OWNER', '2026-10-20').canCancel, false);
  assert.equal(getCancellationTerms(scheduled, 'OWNER', '2026-09-20').canCancel, true);
});

test('does not allow a confirmed stay to be cancelled on its arrival day', () => {
  assert.equal(getCancellationTerms(booking, 'TENANT', '2026-11-01').canCancel, false);
});

test('Haven can cancel until the arrival day and always refunds a paid stay in full', () => {
  assert.equal(getCancellationTerms(booking, 'HAVEN', '2026-10-30').refundAmount, 240);
  assert.equal(getCancellationTerms(booking, 'HAVEN', '2026-11-01').canCancel, true);
  assert.equal(getCancellationTerms(booking, 'HAVEN', '2026-11-02').canCancel, false);
  assert.equal(getCancellationTerms({ ...booking, status: 'PENDING', paymentStatus: 'PENDING' }, 'HAVEN', '2026-10-30').refundAmount, 0);
});
