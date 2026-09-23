import assert from 'node:assert/strict';
import test from 'node:test';
import { limitListingDescription, MAX_LISTING_DESCRIPTION_LENGTH } from '../services/listingDescription';

test('keeps listing descriptions within 1000 characters', () => {
  const description = `${'Un logement lumineux et confortable. '.repeat(30)}Fin.`;
  const result = limitListingDescription(description);
  assert.ok(result.length <= MAX_LISTING_DESCRIPTION_LENGTH);
  assert.ok(result.endsWith('…'));
});

test('preserves a short listing description', () => {
  assert.equal(limitListingDescription('  Chambre calme et lumineuse.  '), 'Chambre calme et lumineuse.');
});
