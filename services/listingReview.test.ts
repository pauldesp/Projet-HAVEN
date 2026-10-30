import { CLEANING_POLICY_VERSION } from './cleaningPolicy';
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Listing, User } from '../types';
import { prepareListingReview } from './listingReview';

const owner = {
  role: 'OWNER', status: 'APPROVED', identityVerified: true, legalAccepted: true,
  firstName: 'Camille', lastName: 'Martin', birthDate: '1998-02-14', phone: '+33612345678',
  emailVerified: true, phoneVerified: false, documents: { idCard: 'document' }
} as User;
const listing = {
  cleaningPolicyVersion: CLEANING_POLICY_VERSION, id: 'listing-1', ownerId: 'owner-1', status: 'PENDING', title: 'Maison calme',
  description: 'Une maison en colocation.', address: '10 rue des Fleurs', city: 'Paris',
  mainPhotoUrl: 'photo1', galleryUrls: ['photo1', 'photo2', 'photo3'], totalRooms: 1,
  rooms: [{ id: 'room-1', name: 'Chambre 1', size: 12, pricePerDay: 25, hasDesk: true, photoUrl: 'room-photo' }]
} as Listing;

test('l’annonce examinée est validée avec attribution de la décision à l’administrateur', () => {
  const result = prepareListingReview(listing, owner, 'APPROVED', true, undefined, 'admin-1', '2026-10-16T21:00:00Z');
  assert.equal(result.status, 'APPROVED');
  assert.equal(result.rejectionReason, null);
  assert.equal(result.reviewedBy, 'admin-1');
  assert.equal(result.reviewedAt, '2026-10-16T21:00:00Z');
  assert.equal(prepareListingReview(listing, { ...owner, role: 'TENANT' } as User, 'APPROVED', true, '', 'admin').status, 'APPROVED');
});
test('la validation refuse un examen non confirmé, un brouillon et un propriétaire non validé', () => {
  assert.throws(() => prepareListingReview(listing, owner, 'APPROVED', false, '', 'admin'), /contrôle/);
  assert.throws(() => prepareListingReview({ ...listing, status: 'DRAFT' }, owner, 'APPROVED', true, '', 'admin'), /transmettre/);
  for (const invalidOwner of [undefined, { ...owner, status: 'PENDING' }, { ...owner, identityVerified: false }]) {
    assert.throws(() => prepareListingReview(listing, invalidOwner as User | undefined, 'APPROVED', true, '', 'admin'), /propriétaire/);
  }
});
test('les informations, chambres et photos manquantes empêchent la publication', () => {
  const incomplete: Partial<Listing>[] = [
    { title: '' }, { address: '' }, { description: '' }, { city: '' }, { rooms: [] }, { totalRooms: 2 },
    { rooms: [{ ...listing.rooms[0], pricePerDay: NaN }] },
    { rooms: [{ ...listing.rooms[0], size: 0 }] },
    { rooms: [{ ...listing.rooms[0], hasDesk: false }] },
    { rooms: [{ ...listing.rooms[0], photoUrl: '' }] }, { galleryUrls: ['photo1'], mainPhotoUrl: 'photo1' }
  ];
  for (const fields of incomplete) assert.throws(() => prepareListingReview({ ...listing, ...fields }, owner, 'APPROVED', true, '', 'admin'));
});
test('le refus exige un motif et reste possible lorsque le dossier propriétaire est incomplet', () => {
  const result = prepareListingReview(listing, undefined, 'REJECTED', false, ' Photos à refaire ', 'admin');
  assert.equal(result.status, 'REJECTED');
  assert.equal(result.rejectionReason, 'Photos à refaire');
  assert.throws(() => prepareListingReview(listing, owner, 'REJECTED', false, ' ', 'admin'), /motif/);
  assert.throws(() => prepareListingReview(listing, owner, 'REJECTED', false, 'x'.repeat(2001), 'admin'), /motif/);
  assert.throws(() => prepareListingReview(listing, owner, 'DRAFT', true, '', 'admin'), /invalide/);
});
