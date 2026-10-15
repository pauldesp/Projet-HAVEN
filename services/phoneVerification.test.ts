import test from 'node:test';
import assert from 'node:assert/strict';
import { clearPhoneRecaptcha, finishPhoneVerification, isValidPhoneForVerification, normalizePhoneForVerification, phoneVerificationErrorMessage } from './phoneVerification';

test('un numéro français saisi sur mobile est envoyé et comparé au format international', () => {
  for (const input of ['06 95 39 86 56', '0695398656', '0033 6 95 39 86 56', '+33 6 95 39 86 56']) {
    assert.equal(normalizePhoneForVerification(input), '+33695398656');
  }
  assert.equal(isValidPhoneForVerification(normalizePhoneForVerification('0695398656')), true);
  assert.equal(isValidPhoneForVerification(normalizePhoneForVerification('06 95')), false);
});

test('un domaine de prévisualisation non autorisé donne une action compréhensible', () => {
  assert.match(phoneVerificationErrorMessage({ code: 'auth/captcha-check-failed' }), /domaine autorisé/);
  assert.match(phoneVerificationErrorMessage({ code: 'auth/operation-not-allowed' }), /pas encore activé/);
});

test('la confirmation puis la sortie de page ne détruisent reCAPTCHA qu’une fois', () => {
  let clears = 0;
  const ref = { current: { clear() { if (++clears > 1) throw new Error('auth/internal-error'); } } as { clear(): void } | null };
  clearPhoneRecaptcha(ref);
  assert.doesNotThrow(() => clearPhoneRecaptcha(ref));
  assert.equal(clears, 1);
  assert.equal(ref.current, null);
});

test('un code valide est confirmé avant la synchronisation du profil', async () => {
  const calls: string[] = [];
  await finishPhoneVerification({
    confirmCode: async () => { calls.push('sms'); }, refreshToken: async () => { calls.push('token'); },
    syncProfile: async () => { calls.push('server'); }, refreshProfile: async () => { calls.push('profile'); }
  });
  assert.deepEqual(calls, ['sms', 'token', 'server', 'profile']);
});

test('un code incorrect ne peut pas valider le téléphone dans le profil', async () => {
  let synchronized = false;
  await assert.rejects(finishPhoneVerification({ confirmCode: async () => { throw new Error('invalid-code'); },
    refreshToken: async () => {}, syncProfile: async () => { synchronized = true; }, refreshProfile: async () => {}
  }), /invalid-code/);
  assert.equal(synchronized, false);
});
