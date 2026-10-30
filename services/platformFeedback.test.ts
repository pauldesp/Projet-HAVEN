import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlatformFeedback } from './platformFeedback';

test('private Haven feedback is optional and independent from the public stay rating', () => {
  assert.equal(normalizePlatformFeedback(undefined), undefined);
  assert.equal(normalizePlatformFeedback(null), undefined);
  assert.deepEqual(normalizePlatformFeedback({ rating: 2, comment: '  Le calendrier pourrait être plus lisible.  ', authorId: 'spoof', targetId: 'listing' }), { rating: 2, comment: 'Le calendrier pourrait être plus lisible.' });
});
test('Haven rating must be explicitly chosen and comments stay within the private feedback limit', () => {
  for (const rating of [0, 6, 2.5, '5', undefined]) assert.throws(() => normalizePlatformFeedback({ rating, comment: '' }));
  assert.throws(() => normalizePlatformFeedback({ rating: 3, comment: 'x'.repeat(2001) }));
  assert.throws(() => normalizePlatformFeedback({ rating: 3, comment: { html: 'x' } }));
  assert.throws(() => normalizePlatformFeedback([]));
  assert.deepEqual(normalizePlatformFeedback({ rating: 1, comment: '' }), { rating: 1, comment: '' });
  assert.equal(normalizePlatformFeedback({ rating: 5, comment: 'x'.repeat(2000) })?.comment.length, 2000);
});
