import assert from 'node:assert/strict';
import test from 'node:test';
import { getCancellationTerms } from './cancellationPolicy';

const booking = { status: 'CONFIRMED' as const, startDate: '2026-11-01', totalPrice: 240, paymentStatus: 'PAID' as const };

test('applies the tenant refund tiers before a stay', () => {
  assert.equal(getCancellationTerms(booking, 'TENANT', '2026-10-01').refundAmount, 240);
  assert.equal(getCancellationTerms(booking, 'TENANT', '2026-10-18').refundAmount, 120);
  assert.equal(getCancellationTerms(booking, 'TENANT', '2026-10-25').refundAmount, 0);
});

test('always refunds a future confirmed stay cancelled by its owner', () => {
  const terms = getCancellationTerms(booking, 'OWNER', '2026-10-30');
  assert.equal(terms.canCancel, true);
  assert.equal(terms.refundPercent, 100);
  assert.equal(terms.refundAmount, 240);
});

test('does not allow a confirmed stay to be cancelled on its arrival day', () => {
  assert.equal(getCancellationTerms(booking, 'TENANT', '2026-11-01').canCancel, false);
});
