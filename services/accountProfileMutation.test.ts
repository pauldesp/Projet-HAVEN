import assert from 'node:assert/strict';
import test from 'node:test';
import { preparePersonalDetails, preparePhoneForVerification } from './accountProfileMutation';

const profile = {
  firstName: 'Camille', lastName: 'Martin', birthDate: '1998-04-12',
  phone: '', identityVerified: false, phoneVerified: false,
  verificationSubmittedAt: '2026-10-13T10:00:00.000Z'
};

test('a member can save a normalized phone before requesting an SMS without self-verifying', () => {
  assert.deepEqual(preparePhoneForVerification(profile, '+33695398656'), {
    phone: '+33695398656', phoneVerified: false, phoneVerifiedAt: null,
    isVerified: false, verificationSubmittedAt: null
  });
  assert.equal(preparePhoneForVerification({ ...profile, phone: '+33695398656' }, '+33695398656'), null);
});

test('phone preparation rejects invalid numbers and replacing a verified number', () => {
  assert.throws(() => preparePhoneForVerification(profile, '0695398656'), /valide/);
  assert.throws(() => preparePhoneForVerification({ ...profile, phoneVerified: true }, '+33695398656'), /confirmé/);
});

test('saving identity details resets an outstanding review but cannot approve the account', () => {
  const update = preparePersonalDetails(profile, {
    firstName: 'Camille', lastName: 'Martin', birthDate: '1998-04-12', phone: '+33695398656'
  });
  assert.equal(update?.verificationSubmittedAt, null);
  assert.equal(update?.phoneVerified, false);
  assert.equal(update?.isVerified, false);
  assert.equal('status' in (update || {}), false);
  assert.equal('identityVerified' in (update || {}), false);
});

test('verified identity and phone details cannot be silently changed', () => {
  assert.throws(() => preparePersonalDetails({ ...profile, identityVerified: true }, {
    firstName: 'Alex', lastName: 'Martin', birthDate: '1998-04-12', phone: '+33695398656'
  }), /identité/);
  assert.throws(() => preparePersonalDetails({ ...profile, phone: '+33695398656', phoneVerified: true }, {
    firstName: 'Camille', lastName: 'Martin', birthDate: '1998-04-12', phone: '+33699999999'
  }), /téléphone/);
});
