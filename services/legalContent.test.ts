import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLegalSpacing } from './legalContent';

const NBSP = String.fromCharCode(0xa0);

test('les espaces insécables entre les mots redeviennent des espaces normales', () => {
  assert.equal(normalizeLegalSpacing(`Les&nbsp;présentes${NBSP}Conditions`), 'Les présentes Conditions');
});

test('la typographie française garde ses espaces insécables', () => {
  assert.equal(
    normalizeLegalSpacing('les&nbsp;«&nbsp;CGR&nbsp;»&nbsp;: oui&nbsp;?'),
    `les «${NBSP}CGR${NBSP}»${NBSP}: oui${NBSP}?`
  );
});
