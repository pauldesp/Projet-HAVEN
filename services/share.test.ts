import test from 'node:test';
import assert from 'node:assert/strict';
import { shareOrCopy } from './share';

const data = { title: 'Annonce', url: 'https://example.test/annonce' };
const noFallback = () => false;

test('le partage natif est utilisé en priorité', async () => {
  assert.equal(await shareOrCopy(data, { share: async () => {} }, noFallback), 'shared');
});

test('annuler le partage natif ne copie rien', async () => {
  let copied = false;
  const share = async () => { throw new DOMException('cancelled', 'AbortError'); };
  assert.equal(await shareOrCopy(data, { share }, () => { copied = true; return true; }), 'cancelled');
  assert.equal(copied, false);
});

test('sans partage natif ni presse-papiers, le lien est copié autrement', async () => {
  let copiedText = '';
  assert.equal(await shareOrCopy(data, {}, text => { copiedText = text; return true; }), 'copied');
  assert.equal(copiedText, data.url);
});

test('un presse-papiers refusé passe aussi par la copie de secours', async () => {
  const clipboard = { writeText: async () => { throw new Error('denied'); } };
  assert.equal(await shareOrCopy(data, { clipboard }, () => true), 'copied');
});

test('le partage reste indisponible si toutes les solutions échouent', async () => {
  assert.equal(await shareOrCopy(data, {}, noFallback), 'unavailable');
});
