import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countNights, isBookableStay } from '../services/stay';
test('charges nights excluding checkout', () => {
  assert.equal(countNights('2026-09-18', '2026-09-20'), 2);
  assert.equal(countNights('2026-09-18', '2026-09-19'), 1);
});
test('counts calendar nights across daylight saving changes', () => {
  assert.equal(countNights('2026-03-28', '2026-03-30'), 2);
  assert.equal(countNights('2026-10-24', '2026-10-26'), 2);
});
test('rejects missing, reversed, same-day and impossible dates', () => {
  for (const [a,b] of [['',''], ['2026-09-20','2026-09-18'], ['2026-09-18','2026-09-18'], ['2026-02-30','2026-03-03']]) assert.equal(countNights(a,b),0);
});

test('rejects a stay that starts before today', () => {
  const now = new Date(2026, 8, 23, 12);
  assert.equal(isBookableStay('2026-09-22', '2026-09-25', now), false);
  assert.equal(isBookableStay('2026-09-23', '2026-09-25', now), true);
  assert.equal(isBookableStay('2026-09-24', '2026-09-25', now), true);
});
