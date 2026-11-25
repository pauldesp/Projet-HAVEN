import assert from 'node:assert/strict';
import test from 'node:test';
import { RESIDENCE_DECLARATION_TEXT, RESIDENCE_DECLARATION_VERSION, assertResidenceDeclared, residenceDeclarationRecord } from './residenceDeclaration';

test('the main residence declaration is required with its current version', () => {
  assert.throws(() => assertResidenceDeclared(undefined), /résidence principale/);
  assert.throws(() => assertResidenceDeclared(true), /résidence principale/);
  assert.throws(() => assertResidenceDeclared('haven-residence-ancienne'), /résidence principale/);
  assert.doesNotThrow(() => assertResidenceDeclared(RESIDENCE_DECLARATION_VERSION));
});

test('the proof keeps the exact text, the version and the date', () => {
  assert.deepEqual(residenceDeclarationRecord('2026-11-25T10:00:00.000Z'), { version: RESIDENCE_DECLARATION_VERSION, text: RESIDENCE_DECLARATION_TEXT, declaredAt: '2026-11-25T10:00:00.000Z' });
  assert.match(RESIDENCE_DECLARATION_TEXT, /^Je déclare disposer d’une résidence principale distincte de cette chambre et ne pas y domicilier mon courrier, une entreprise ou une démarche administrative\.$/);
});
