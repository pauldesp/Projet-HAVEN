import test from 'node:test';
import assert from 'node:assert/strict';
import { assertAccountTermsConsent, registrationPasswordError, selectAccountTerms } from './accountTerms';

const terms = { id: 'conditions-generales', title: 'Conditions générales', content: '# Conditions réelles', lastUpdated: '2026-10-15' };
test('password confirmation must match exactly before account creation', () => {
  assert.match(registrationPasswordError('Abcdefg1', 'Abcdefg2')!, /correspondent/);
  for (const invalid of ['Abcdef1', 'abcdefg1', 'Abcdefgh']) {
    assert.match(registrationPasswordError(invalid, invalid)!, /8 caractères, une majuscule et un chiffre/);
  }
  assert.equal(registrationPasswordError('Abcdefg1', 'Abcdefg1'), null);
});
test('account validation uses the published terms instead of a fabricated fallback', () => {
  assert.equal(selectAccountTerms([terms]), terms);
  assert.equal(selectAccountTerms([]), null);
  assert.equal(selectAccountTerms([{ ...terms, content: '' }]), null);
});
test('consent is explicit and bound to the version actually read', () => {
  assert.throws(() => assertAccountTermsConsent(false, terms.lastUpdated, terms), /Acceptez/);
  assert.throws(() => assertAccountTermsConsent(true, 'old-version', terms), /changé/);
  assert.throws(() => assertAccountTermsConsent(true, terms.lastUpdated, null), /indisponibles/);
  assert.doesNotThrow(() => assertAccountTermsConsent(true, terms.lastUpdated, terms));
});
