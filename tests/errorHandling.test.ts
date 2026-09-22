import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyError } from '../services/errorHandling';

test('keeps an error code when a user-facing error is handled twice', () => {
  assert.equal(classifyError(new Error('La synchronisation est indisponible. (Erreur 402)')).code, '402');
});

test('classifies Firestore transport failures as synchronization errors', () => {
  assert.equal(classifyError(new Error('FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state')).code, '402');
});
