import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createRandomId } from './randomId';

test('booking and message identifiers work without the secure-context randomUUID API', () => {
  const httpCrypto = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } as Pick<Crypto, 'getRandomValues'>;
  assert.equal('randomUUID' in httpCrypto, false);
  const ids = Array.from({ length: 1000 }, () => createRandomId(httpCrypto));
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.match(`b-${id}`, /^[a-zA-Z0-9_-]{1,128}$/);
    assert.match(`m-${id}`, /^[a-zA-Z0-9_-]{1,128}$/);
  }
});
