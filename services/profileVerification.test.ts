import test from 'node:test';
import assert from 'node:assert/strict';
import { hasCompleteVerificationDetails, isAccountVerificationComplete, isValidPastBirthDate, isVerificationPending, isVerificationReadyForAdminReview, isVerificationReadyToSubmit, personalDetailsUpdate } from './profileVerification';

test('une date de naissance doit être réelle et antérieure à aujourd’hui', () => {
  assert.equal(isValidPastBirthDate('2000-02-29', '2026-10-13'), true);
  assert.equal(isValidPastBirthDate('2026-10-13', '2026-10-13'), false);
  assert.equal(isValidPastBirthDate('2026-10-14', '2026-10-13'), false);
  assert.equal(isValidPastBirthDate('2025-02-29', '2026-10-13'), false);
});

test('un dossier incomplet ne peut pas être transmis', () => {
  const details = { firstName: 'Camille', lastName: 'Martin', birthDate: '2000-02-29', phone: '+33612345678' };
  assert.equal(hasCompleteVerificationDetails(details), true);
  assert.equal(hasCompleteVerificationDetails({ ...details, birthDate: '' }), false);
  assert.equal(hasCompleteVerificationDetails({ ...details, phone: '0612345678' }), false);
  assert.equal(hasCompleteVerificationDetails({ ...details, firstName: ' ' }), false);
});

test('dépôt, transmission et validation administrative restent trois étapes distinctes', () => {
  const profile = {
    firstName: 'Camille', lastName: 'Martin', birthDate: '2000-02-29', phone: '+33612345678',
    emailVerified: false, phoneVerified: false, documents: { idCard: 'data:image/jpeg;base64,abc', proofOfAddress: '/private-proof' }, residenceProvided: true,
    status: 'PENDING', identityVerified: false, legalAccepted: true, verificationSubmittedAt: null as string | null
  };
  assert.equal(isVerificationReadyToSubmit(profile), false, 'la pièce seule ne permet pas la transmission');
  assert.equal(isVerificationReadyForAdminReview(profile), false);
  assert.equal(isAccountVerificationComplete(profile), false);

  const contactsVerified = { ...profile, emailVerified: true, phoneVerified: false };
  assert.equal(isVerificationReadyToSubmit(contactsVerified), true);
  assert.equal(isVerificationReadyForAdminReview(contactsVerified), false, 'la transmission doit être explicite');
  assert.equal(isVerificationPending(contactsVerified), false);

  const submitted = { ...contactsVerified, verificationSubmittedAt: '2026-10-13T20:00:00.000Z' };
  assert.equal(isVerificationReadyForAdminReview(submitted), true);
  assert.equal(isVerificationPending(submitted), true);
  assert.equal(isVerificationPending({ ...submitted, status: 'REJECTED' }), false);
  assert.equal(isVerificationPending({ ...submitted, verificationSubmittedAt: null }), false);
  assert.equal(isVerificationReadyForAdminReview({ ...submitted, legalAccepted: false }), false, 'les CG doivent être acceptées avant examen');
  assert.equal(isAccountVerificationComplete(submitted), false, 'un administrateur doit encore approuver');
  assert.equal(isVerificationReadyForAdminReview({ ...submitted, documents: {} }), false, 'remplacer la pièce exige un nouvel examen');

  const reviewed = { ...submitted, identityVerified: true, status: 'APPROVED' };
  assert.equal(isAccountVerificationComplete(reviewed), true);
  assert.equal(isVerificationPending(reviewed), false);
  assert.equal(isAccountVerificationComplete({ ...reviewed, phone: '' }), false, 'le numéro reste obligatoire même sans SMS');
  assert.equal(isAccountVerificationComplete({ ...reviewed, emailVerified: false }), false, 'l’e-mail reste à confirmer');
});

test('modifier des données déjà soumises exige une nouvelle transmission du dossier', () => {
  const details = { firstName: 'Camille', lastName: 'Martin', birthDate: '2000-02-29', phone: '+33612345678' };
  const submitted = { ...details, verificationSubmittedAt: '2026-10-13T20:00:00.000Z' };
  assert.deepEqual(personalDetailsUpdate(submitted, details), details, 'un simple réenregistrement garde la transmission');
  assert.deepEqual(personalDetailsUpdate(submitted, { ...details, lastName: 'Durand' }), {
    ...details, lastName: 'Durand', verificationSubmittedAt: null
  });
});
