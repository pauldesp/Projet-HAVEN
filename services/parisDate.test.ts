import test from 'node:test';
import assert from 'node:assert/strict';
import { parisDateKey } from './stay';
import { getCancellationTerms } from './cancellationPolicy';

const paid = { status: 'CONFIRMED' as const, paymentStatus: 'PAID' as const, totalPrice: 300 };

test('at 00:30 in Paris, today is already the new day (the UTC date is still yesterday)', () => {
  assert.equal(parisDateKey(new Date('2026-11-21T23:30:00Z')), '2026-11-22'); // winter, UTC+1
  assert.equal(parisDateKey(new Date('2026-07-14T22:30:00Z')), '2026-07-15'); // summer, UTC+2
  assert.equal(parisDateKey(new Date('2026-11-22T10:00:00Z')), '2026-11-22');
});

test('the refund tier uses the Paris date: 30 days before arrival at 00:30 is no longer a full refund', () => {
  // Arrival 22 December; at 00:30 on 22 November in Paris there are 30 days left, the UTC date (21 Nov) said 31.
  const atHalfPastMidnight = getCancellationTerms({ ...paid, startDate: '2026-12-22' }, 'TENANT', parisDateKey(new Date('2026-11-21T23:30:00Z')));
  assert.equal(atHalfPastMidnight.daysBeforeArrival, 30);
  const dayBefore = getCancellationTerms({ ...paid, startDate: '2026-12-22' }, 'TENANT', '2026-11-21');
  assert.equal(dayBefore.daysBeforeArrival, 31);
});

test('days before arrival are exact across the spring time change (23-hour day)', () => {
  // Summer time starts on 29 March 2026: 30 calendar days from 1 March to 31 March.
  const terms = getCancellationTerms({ ...paid, startDate: '2026-03-31' }, 'TENANT', '2026-03-01');
  assert.equal(terms.daysBeforeArrival, 30);
  assert.equal(terms.refundPercent, 100);
});
