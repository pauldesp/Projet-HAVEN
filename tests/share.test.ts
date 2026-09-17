import assert from 'node:assert/strict';
import test from 'node:test';
import { shareOrCopy } from '../services/share';

const data = { title: 'Coloc Martin | HAVEN', text: 'Découvrez cette annonce.', url: 'https://haven.test/#/listing/1' };

test('uses native browser sharing when it is available', async () => {
  let received: ShareData | undefined;
  const result = await shareOrCopy(data, { share: async (value) => { received = value; } });
  assert.equal(result, 'shared');
  assert.deepEqual(received, data);
});

test('copies the listing link when native sharing is unavailable', async () => {
  let copied = '';
  const result = await shareOrCopy(data, { clipboard: { writeText: async (value) => { copied = value; } } });
  assert.equal(result, 'copied');
  assert.equal(copied, data.url);
});
