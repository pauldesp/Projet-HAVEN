import test from 'node:test';
import assert from 'node:assert/strict';
import { needsNewReview } from './listingChanges';
import type { Listing } from '../types';

const listing = { id: 'l', title: 'Coloc Martin', description: 'Calme', city: 'Lagord', status: 'APPROVED', mainPhotoUrl: 'a.jpg', galleryUrls: ['a.jpg', 'b.jpg', 'c.jpg'], minStay: 4, cleaningFee: 15,
  rooms: [{ id: 'r', name: 'Horizon', pricePerDay: 30, photoUrl: 'r.jpg', blockedDates: [] }], blockedDates: [] } as unknown as Listing;

test('textes, photos et adresse d’une annonce publiée repassent en vérification', () => {
  assert.equal(needsNewReview(listing, { ...listing, title: 'Coloc Martin rénovée' }), true);
  assert.equal(needsNewReview(listing, { ...listing, galleryUrls: ['a.jpg', 'b.jpg', 'd.jpg'] }), true);
  assert.equal(needsNewReview(listing, { ...listing, rooms: [{ ...listing.rooms[0], photoUrl: 'autre.jpg' }] }), true);
});

test('prix, minimum de nuits et dates bloquées se modifient sans nouvelle vérification', () => {
  assert.equal(needsNewReview(listing, { ...listing, minStay: 3, cleaningFee: 20, blockedDates: ['2026-12-24'], rooms: [{ ...listing.rooms[0], pricePerDay: 35, blockedDates: ['2026-12-25'] }] }), false);
  assert.equal(needsNewReview({ ...listing, status: 'PENDING' } as Listing, { ...listing, title: 'Autre' }), false);
});
