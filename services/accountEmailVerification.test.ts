import assert from 'node:assert/strict';
import test from 'node:test';
import { emailRetrySeconds, finishAccountEmailVerification, requestAccountEmailVerification } from './accountEmailVerification';

const profile = { id: 'member-1', email: 'camille@example.com' };

test('le délai de renvoi reste bloquant jusqu’à son expiration exacte', () => {
  assert.equal(emailRetrySeconds(61_000, 1_000), 60);
  assert.equal(emailRetrySeconds(61_000, 60_999), 1);
  assert.equal(emailRetrySeconds(61_000, 61_000), 0);
  assert.equal(emailRetrySeconds(61_000, 70_000), 0);
  assert.equal(emailRetrySeconds(NaN, 1_000), 0);
});

test('un compte non vérifié reçoit un lien sans être marqué confirmé', async () => {
  const account = { uid: profile.id, email: profile.email, emailVerified: false };
  const calls: string[] = [];
  const result = await requestAccountEmailVerification(account, profile, {
    reload: async () => { calls.push('reload'); },
    send: async () => { calls.push('send'); },
    confirm: async () => { calls.push('confirm'); },
  });
  assert.equal(result, 'sent');
  assert.deepEqual(calls, ['reload', 'send']);
});

test('une adresse déjà validée par Firebase est synchronisée sans renvoyer de lien', async () => {
  const account = { uid: profile.id, email: profile.email, emailVerified: false };
  const calls: string[] = [];
  const result = await requestAccountEmailVerification(account, profile, {
    reload: async () => { account.emailVerified = true; calls.push('reload'); },
    send: async () => { calls.push('send'); },
    confirm: async () => { calls.push('confirm'); },
  });
  assert.equal(result, 'confirmed');
  assert.deepEqual(calls, ['reload', 'confirm']);
});

test('le retour du lien ne confirme le profil qu’après vérification réelle', async () => {
  const account = { uid: profile.id, email: profile.email, emailVerified: false };
  let confirmations = 0;
  const actions = { reload: async () => {}, confirm: async () => { confirmations += 1; } };
  assert.equal(await finishAccountEmailVerification(account, profile, actions), false);
  assert.equal(confirmations, 0);
  account.emailVerified = true;
  assert.equal(await finishAccountEmailVerification(account, profile, actions), true);
  assert.equal(confirmations, 1);
});

test('une session ouverte sur un autre compte est refusée', async () => {
  await assert.rejects(() => requestAccountEmailVerification(
    { uid: 'another', email: profile.email, emailVerified: true }, profile,
    { reload: async () => {}, send: async () => {}, confirm: async () => {} },
  ));
});

test('un retour sur Haven après validation du lien synchronise sans nouvel envoi', async () => {
  const account = { uid: profile.id, email: profile.email, emailVerified: false };
  let serverConfirmations = 0;
  const confirmed = await finishAccountEmailVerification(account, profile, {
    reload: async () => { account.emailVerified = true; },
    confirm: async () => { serverConfirmations += 1; }
  });
  assert.equal(confirmed, true);
  assert.equal(serverConfirmations, 1);
});

test('une erreur de lecture Firebase ne marque jamais l’adresse comme confirmée', async () => {
  let serverConfirmations = 0;
  await assert.rejects(finishAccountEmailVerification(
    { uid: profile.id, email: profile.email, emailVerified: false }, profile,
    { reload: async () => { throw new Error('network'); }, confirm: async () => { serverConfirmations += 1; } }
  ), /network/);
  assert.equal(serverConfirmations, 0);
});
