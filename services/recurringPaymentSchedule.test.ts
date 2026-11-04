import test from 'node:test';
import assert from 'node:assert/strict';
import { monthBeforeArrival, recurringPaymentSchedule } from './recurringPaymentSchedule';

test('monthly deadlines handle month ends, leap years and year changes', () => {
  assert.equal(monthBeforeArrival('2027-03-31'), '2027-02-28');
  assert.equal(monthBeforeArrival('2028-03-31'), '2028-02-29');
  assert.equal(monthBeforeArrival('2027-01-15'), '2026-12-15');
});

test('first stay and deadlines already reached are due now; future stays have their own deadline', () => {
  const plan = recurringPaymentSchedule([
    { index: 0, start: '2026-11-08', end: '2026-11-13', amount: 101 },
    { index: 1, start: '2026-11-22', end: '2026-11-27', amount: 130 },
    { index: 2, start: '2026-12-26', end: '2026-12-31', amount: 140 },
  ], new Date('2026-11-04T12:00:00Z'));
  assert.equal(plan.dueNow, 231);
  assert.equal(plan.later, 140);
  assert.equal(plan.total, 371);
  assert.equal(plan.entries[2].dueDate, '2026-11-26');
});

test('first available stay is due at reservation even when far in the future', () => {
  const plan = recurringPaymentSchedule([{ index: 2, start: '2027-05-20', end: '2027-05-25', amount: 150 }], new Date('2026-11-04T12:00:00Z'));
  assert.equal(plan.dueNow, 150);
  assert.equal(plan.entries[0].index, 2);
});
