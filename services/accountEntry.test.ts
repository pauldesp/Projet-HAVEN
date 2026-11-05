import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAccountIdentifier, normalizeEmailInput, resolveAccountEntry } from './accountEntry';

const missing = async () => { throw { code: 'auth/user-not-found' }; };
test('typed emails lose keyboard capitalization and accents, including decomposed pasted accents', () => {
  assert.equal(normalizeEmailInput('Propriétaire@GMAIL.COM'), 'proprietaire@gmail.com');
  assert.equal(normalizeEmailInput('E\u0301LE\u0300VE@Exa\u0308mple.FR'), 'eleve@example.fr');
  assert.equal(normalizeEmailInput('06 95 39 86 56'), '06 95 39 86 56');
  assert.equal(normalizeAccountIdentifier('  Propriétaire@GMAIL.COM  ').value, 'proprietaire@gmail.com');
});
test('accented email entry looks up the corrected address instead of treating an existing account as new', async () => {
  const result = await resolveAccountEntry('Propriétaire@EXAMPLE.COM', {
    email: async email => { assert.equal(email, 'proprietaire@example.com'); }, phone: missing,
  });
  assert.equal(result.exists, true);
  assert.equal(result.identifier, 'proprietaire@example.com');
});
test('new email and French phone numbers enter registration after normalization', async () => {
  const lookup = { email: missing, phone: missing };
  assert.deepEqual(await resolveAccountEntry(' New@Example.com ', lookup), { identifier: 'new@example.com', kind: 'email', exists: false });
  assert.deepEqual(await resolveAccountEntry('06 95 39 86 56', lookup), { identifier: '+33695398656', kind: 'phone', exists: false });
});
test('existing accounts enter login through the correct identifier lookup', async () => {
  const lookup = { email: async (v: string) => { assert.equal(v, 'member@example.com'); }, phone: async (v: string) => { assert.equal(v, '+33695398656'); } };
  assert.equal((await resolveAccountEntry('member@example.com', lookup)).exists, true);
  assert.equal((await resolveAccountEntry('0695398656', lookup)).exists, true);
});
test('invalid inputs and Firebase failures never silently open registration', async () => {
  for (const value of ['', 'abc', 'a@', '06 95', null]) assert.throws(() => normalizeAccountIdentifier(value));
  const unavailable = async () => { throw new Error('Firebase unavailable'); };
  await assert.rejects(resolveAccountEntry('member@example.com', { email: unavailable, phone: missing }), /unavailable/);
});
