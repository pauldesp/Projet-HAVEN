import assert from 'node:assert/strict';
import test from 'node:test';
import { canConfirmEmailOwnership } from './emailOwnership';

test('une adresse vérifiée par Firebase peut être confirmée sans service de codes externe', () => {
  assert.equal(canConfirmEmailOwnership('camille@example.com', 'camille@example.com', true, 0, 1000), true);
});

test('une adresse non vérifiée ne peut pas être confirmée sans code encore valide', () => {
  assert.equal(canConfirmEmailOwnership('camille@example.com', 'camille@example.com', false, 0, 1000), false);
  assert.equal(canConfirmEmailOwnership('camille@example.com', 'camille@example.com', false, 1000, 1000), false);
  assert.equal(canConfirmEmailOwnership('camille@example.com', 'camille@example.com', false, 1001, 1000), true);
});

test('une preuve pour une autre adresse ne permet pas de valider le compte', () => {
  assert.equal(canConfirmEmailOwnership('camille@example.com', 'autre@example.com', true, 2000, 1000), false);
  assert.equal(canConfirmEmailOwnership('', 'camille@example.com', true, 2000, 1000), false);
});
