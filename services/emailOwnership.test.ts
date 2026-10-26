import assert from 'node:assert/strict';
import test from 'node:test';
import { canConfirmEmailOwnership } from './emailOwnership';

test('une adresse vérifiée par Firebase peut être confirmée', () => {
  assert.equal(canConfirmEmailOwnership('camille@example.com', 'camille@example.com', true), true);
});
test('une adresse non vérifiée par Firebase ne peut pas être confirmée', () => {
  assert.equal(canConfirmEmailOwnership('camille@example.com', 'camille@example.com', false), false);
});
test('une preuve pour une autre adresse ne permet pas de valider le compte', () => {
  assert.equal(canConfirmEmailOwnership('camille@example.com', 'autre@example.com', true), false);
  assert.equal(canConfirmEmailOwnership('', 'camille@example.com', true), false);
});
