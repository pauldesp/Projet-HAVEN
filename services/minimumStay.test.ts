import test from 'node:test';
import assert from 'node:assert/strict';
import { minimumNights, isValidMinimumNights } from './minimumStay';
test('four nights by default and owner overrides in either direction', () => {
  assert.equal(minimumNights(), 4);
  assert.equal(minimumNights(1), 1);
  assert.equal(minimumNights(7), 7);
  assert.equal(minimumNights(30), 30);
});
test('minimum duration must be a positive whole number', () => {
  for (const value of [0, -1, 1.5, NaN, Infinity]) assert.equal(isValidMinimumNights(value), false);
  for (const value of [1, 4, 30]) assert.equal(isValidMinimumNights(value), true);
});
