import test from 'node:test';
import assert from 'node:assert/strict';
import { createPendingMemberProfile } from './memberProfile';

test('une première connexion Google crée une fiche en attente sans valeur refusée par Firestore', () => {
  const profile = createPendingMemberProfile({
    uid: 'google-user', displayName: 'Camille Martin', email: 'camille@example.com',
    phoneNumber: null, photoURL: null, emailVerified: true
  });
  assert.equal(profile.status, 'PENDING');
  assert.equal(profile.emailVerified, true);
  assert.equal(profile.phoneVerified, false);
  assert.equal(profile.isVerified, false);
  assert.equal(profile.identityVerified, false);
  assert.equal(Object.hasOwn(profile, 'phone'), false);
  assert.equal(Object.values(profile).some(value => value === undefined), false);
});

test('une fiche manquante est reconstruite sans accorder une validation de compte', () => {
  const profile = createPendingMemberProfile({
    uid: 'email-user', displayName: null, email: 'membre@example.com',
    phoneNumber: '+33612345678', photoURL: null, emailVerified: false
  });
  assert.equal(profile.firstName, 'Utilisateur');
  assert.equal(profile.lastName, 'HAVEN');
  assert.equal(profile.phoneVerified, true);
  assert.equal(profile.identityVerified, false);
  assert.equal(profile.isVerified, false);
  assert.equal(profile.status, 'PENDING');
});
