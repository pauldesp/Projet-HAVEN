import test from 'node:test';
import assert from 'node:assert/strict';
import { createGooglePopupSignIn, googleSignInErrorMessage } from './googleSignIn';

test('Google opens immediately from the tap; duplicate taps share one sign-in and one profile completion', async () => {
  const events: string[] = [];
  let finish!: (result: { user: { uid: string } }) => void;
  const popup = new Promise<{ user: { uid: string } }>(resolve => { finish = resolve; });
  const signIn = createGooglePopupSignIn({
    openPopup: () => { events.push('popup'); return popup; },
    completeProfile: async user => { events.push(`profile:${user.uid}`); },
  });
  const first = signIn();
  assert.deepEqual(events, ['popup']);
  assert.equal(signIn(), first);
  finish({ user: { uid: 'verified-google-user' } });
  assert.equal(await first, true);
  assert.deepEqual(events, ['popup', 'profile:verified-google-user']);
});

test('a blocked Google window never creates a profile and can be retried from a fresh tap', async () => {
  let attempts = 0, profiles = 0;
  const blocked = { code: 'auth/popup-blocked' };
  const signIn = createGooglePopupSignIn({
    openPopup: async () => { if (++attempts === 1) throw blocked; return { user: { uid: 'google-user' } }; },
    completeProfile: async () => { profiles++; },
  });
  await assert.rejects(signIn(), error => error === blocked);
  assert.equal(profiles, 0);
  assert.equal(await signIn(), true);
  assert.equal(attempts, 2);
  assert.equal(profiles, 1);
});

test('profile persistence must succeed before Google sign-in reports success', async () => {
  const failure = new Error('profile unavailable');
  const signIn = createGooglePopupSignIn({
    openPopup: async () => ({ user: { uid: 'google-user' } }),
    completeProfile: async () => { throw failure; },
  });
  await assert.rejects(signIn(), error => error === failure);
});

test('a missing Google result never authenticates or creates a member', async () => {
  let profiles = 0;
  const signIn = createGooglePopupSignIn({
    openPopup: async () => ({ user: null }),
    completeProfile: async () => { profiles++; },
  });
  await assert.rejects(signIn(), /n’a pas abouti/);
  assert.equal(profiles, 0);
});

test('Google errors distinguish popup blocking, cancellation, existing credentials and provider configuration', () => {
  assert.match(googleSignInErrorMessage({ code: 'auth/popup-blocked' }), /bloquée.*Autorisez/);
  assert.match(googleSignInErrorMessage({ code: 'auth/popup-closed-by-user' }), /fermée.*réessayer/);
  assert.match(googleSignInErrorMessage({ code: 'auth/account-exists-with-different-credential' }), /mot de passe/);
  assert.match(googleSignInErrorMessage({ code: 'auth/unauthorized-domain' }), /403/);
  assert.match(googleSignInErrorMessage({ code: 'auth/operation-not-allowed' }), /503/);
  assert.match(googleSignInErrorMessage({ code: 'auth/network-request-failed' }), /402/);
  assert.doesNotMatch(googleSignInErrorMessage({ code: 'auth/internal-error', message: 'PRIVATE_TOKEN' }), /PRIVATE_TOKEN/);
});
