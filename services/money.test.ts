import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEuros, ownerShare } from './money';

const NBSP = /[  ]/g;

test('les montants sont affichés en euros à la française', () => {
  assert.equal(formatEuros(116).replace(NBSP, ' '), '116,00 €');
  assert.equal(formatEuros(181.5).replace(NBSP, ' '), '181,50 €');
  assert.equal(formatEuros(NaN), '—');
});

test('la part du propriétaire exclut les frais Haven', () => {
  assert.equal(ownerShare({ basePrice: 140, cleaningFee: 20, platformFee: 21.5, totalPrice: 181.5 }), 160);
  assert.equal(ownerShare({ basePrice: 140, cleaningFee: 20, platformFee: 21, totalPrice: 999 }), null);
});
