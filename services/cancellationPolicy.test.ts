import assert from 'node:assert/strict';
import test from 'node:test';
import { getCancellationTerms } from './cancellationPolicy';

const booking = { status: 'CONFIRMED' as const, startDate: '2026-11-01', totalPrice: 240, paymentStatus: 'PAID' as const };

test('applies the tenant refund tiers before a stay', () => {
  assert.equal(getCancellationTerms(booking, 'TENANT', '2026-10-01').refundAmount, 240);
  assert.equal(getCancellationTerms(booking, 'TENANT', '2026-10-18').refundAmount, 120);
  assert.equal(getCancellationTerms(booking, 'TENANT', '2026-10-25').refundAmount, 0);
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
