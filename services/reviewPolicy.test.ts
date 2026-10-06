import test from 'node:test';
import assert from 'node:assert/strict';
import { isStayReviewWindowOpen, stayReviewDeadline, REVIEW_WINDOW_MS } from './reviewPolicy';

test('a review remains open for seven full days after the recorded checkout', () => {
  const completedAt = '2026-10-01T12:30:00.000Z';
  const deadline = Date.parse(completedAt) + REVIEW_WINDOW_MS;
  assert.equal(stayReviewDeadline(completedAt, '2026-10-20'), deadline);
  assert.equal(isStayReviewWindowOpen(completedAt, undefined, deadline - 1), true);
  assert.equal(isStayReviewWindowOpen(completedAt, undefined, deadline), false);
});

test('legacy completed stays use their end date when checkout time is absent', () => {
  const deadline = Date.parse('2026-09-10') + REVIEW_WINDOW_MS;
  assert.equal(stayReviewDeadline(undefined, '2026-09-10'), deadline);
  assert.equal(isStayReviewWindowOpen(undefined, 'invalid-date', Date.now()), false);
});
