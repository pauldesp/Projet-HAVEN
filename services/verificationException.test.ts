import { CLEANING_POLICY_VERSION } from './cleaningPolicy';
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTrustedVerificationException, hasVerificationException, prepareVerificationException } from './verificationException';
import { isAccountVerificationComplete } from './profileVerification';
import { prepareMemberModeration } from './memberApproval';
import { prepareListingReview } from './listingReview';
import type { Listing, User } from '../types';
const actor = { uid: 'principal-1', level: 'PRIMARY' };
const incomplete = { id: 'member-1', role: 'TENANT', status: 'APPROVED', emailVerified: false, identityVerified: false };
const update = prepareVerificationException('USER', incomplete, actor, 'GRANT', ' Tests de réservation ', 'decision-1', '2026-10-17T21:00:00Z');

test('seul le principal peut accorder ou retirer une dérogation', () => {
  for (const level of ['STANDARD', '', 'TENANT']) for (const mode of ['GRANT', 'REVOKE']) {
    assert.throws(() => prepareVerificationException('USER', incomplete, { ...actor, level }, mode, 'Test', 'id'), /principal/);
  }
  assert.throws(() => prepareVerificationException('USER', { role: 'ADMIN' }, actor, 'GRANT', 'Test', 'id'), /administrateur/);
  assert.throws(() => prepareVerificationException('OTHER', {}, actor, 'GRANT', 'Test', 'id'));
  assert.throws(() => prepareVerificationException('USER', incomplete, actor, 'GRANT', ' ', 'id'), /motif/);
});
test('forcer un compte déjà marqué approuvé débloque les tests sans inventer de vérifications', () => {
  assert.equal(isAccountVerificationComplete(incomplete), false);
  const profile = { ...incomplete, ...update };
  assert.equal(profile.status, 'APPROVED');
  assert.equal(hasVerificationException(profile), true);
  assert.equal(isAccountVerificationComplete(profile), true);
  assert.equal(profile.emailVerified, false);
  assert.equal(profile.identityVerified, false);
  assert.equal('legalAccepted' in update, false);
  assert.equal('documents' in update, false);
  assert.equal(update.verificationException?.reason, 'Tests de réservation');
});
test('le serveur exige la décision privée correspondante, un statut actif et le bon compte', () => {
  const profile = { ...incomplete, ...update };
  const record = { active: true, decisionId: 'decision-1', subjectId: 'member-1' };
  assert.equal(hasTrustedVerificationException(profile, record, 'member-1'), true);
  for (const forged of [undefined, { ...record, active: false }, { ...record, decisionId: 'other' }, { ...record, subjectId: 'other' }]) assert.equal(hasTrustedVerificationException(profile, forged, 'member-1'), false);
  assert.equal(hasTrustedVerificationException({ ...profile, status: 'BANNED' }, record, 'member-1'), false);
});
test('retrait ou refus suppriment le contournement sans toucher aux preuves réelles', () => {
  const profile = { ...incomplete, ...update };
  const revoked = prepareVerificationException('USER', profile, actor, 'REVOKE', 'Fin des tests', 'decision-2');
  assert.equal(revoked.status, 'PENDING');
  assert.equal(isAccountVerificationComplete({ ...profile, ...revoked }), false);
  assert.equal(prepareMemberModeration(profile, 'BANNED', 'motif', actor.uid).verificationException, null);
  assert.equal(hasVerificationException({ ...profile, status: 'PENDING' }), false);
});
test('une annonce incomplète peut être validée en test mais pas par le parcours normal', () => {
  const listing = { status: 'DRAFT', ownerId: 'member-1', rooms: [] } as unknown as Listing;
  assert.throws(() => prepareListingReview(listing, incomplete as unknown as User, 'APPROVED', true, '', actor.uid));
  const decision = prepareVerificationException('LISTING', listing, actor, 'GRANT', 'Test annonce', 'decision-3');
  assert.equal(decision.status, 'APPROVED');
  assert.equal(decision.verificationException?.grantedBy, actor.uid);
  assert.equal('rooms' in decision, false);
});

test('la validation normale d’une annonce ne croit pas une dérogation propriétaire sans preuve serveur', () => {
  const listing = {
    cleaningPolicyVersion: CLEANING_POLICY_VERSION, status: 'PENDING', title: 'Logement test', description: 'Description', address: '1 rue Test', city: 'Paris',
    totalRooms: 1, mainPhotoUrl: 'photo1', galleryUrls: ['photo1', 'photo2', 'photo3'],
    rooms: [{ name: 'Chambre', size: 12, pricePerDay: 20, hasDesk: true, photoUrl: 'room' }]
  } as Listing;
  const owner = { ...incomplete, ...update } as unknown as User;
  assert.throws(() => prepareListingReview(listing, owner, 'APPROVED', true, '', actor.uid), /propriétaire/);
  assert.equal(prepareListingReview(listing, owner, 'APPROVED', true, '', actor.uid, undefined, true).status, 'APPROVED');
});
