import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleRating } from './adminModerationServer';

test('un avis masqué sort de la note moyenne et du nombre d’avis', () => {
  const reviews = [{ rating: 5 }, { rating: 4 }, { rating: 1, hiddenByHaven: true }];
  assert.deepEqual(visibleRating(reviews), { rating: 4.5, reviewsCount: 2 });
  assert.deepEqual(visibleRating([{ rating: 2, hiddenByHaven: true }]), { rating: 0, reviewsCount: 0 });
});
