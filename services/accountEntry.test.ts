import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAccountIdentifier, resolveAccountEntry } from './accountEntry';

const missing = async () => { throw { code: 'auth/user-not-found' }; };
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
