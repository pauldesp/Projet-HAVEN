import assert from 'node:assert/strict';
import test from 'node:test';
import { getListingPhotoUrls, hasMissingRoomPhoto, normalizeRoomPhotos } from '../services/media';

test('keeps no more than five listing photos in their gallery order', () => {
  const photos = getListingPhotoUrls({ mainPhotoUrl: 'main', galleryUrls: ['main', '2', '3', '4', '5', '6'] });
  assert.deepEqual(photos, ['main', '2', '3', '4', '5']);
});

test('keeps duplicate gallery photos when the owner adds the same file for testing', () => {
  const photos = getListingPhotoUrls({ mainPhotoUrl: 'same', galleryUrls: ['same', 'same', 'same'] });
  assert.deepEqual(photos, ['same', 'same', 'same']);
});

test('keeps only the first room photo', () => {
  const room = normalizeRoomPhotos({ photoUrl: '', roomPhotos: ['room-1', 'room-2'], id: 'r', name: 'Chambre', pricePerDay: 40, size: 10, hasPrivateBath: false, bedSize: 'Double', isAvailable: true });
  assert.deepEqual(room.roomPhotos, ['room-1']);
  assert.equal(room.photoUrl, 'room-1');
});

test('requires one photo for every room', () => {
  assert.equal(hasMissingRoomPhoto([{ photoUrl: '', roomPhotos: [] }, { photoUrl: 'photo', roomPhotos: [] }]), true);
  assert.equal(hasMissingRoomPhoto([{ photoUrl: '', roomPhotos: ['photo'] }]), false);
});
