import assert from 'node:assert/strict';
import test from 'node:test';
import { hasIncompleteRoom, hasRoomWithoutOption, hasUnnamedRoom } from '../services/roomValidation';

test('requires a non-empty name for every room', () => {
  assert.equal(hasUnnamedRoom([{ name: 'Chambre Horizon' }, { name: '  ' }]), true);
  assert.equal(hasUnnamedRoom([{ name: 'Chambre Horizon' }, { name: 'Chambre Azur' }]), false);
});

test('requires a positive nightly price and surface for every room', () => {
  assert.equal(hasIncompleteRoom([{ name: 'Chambre Horizon', pricePerDay: 0, size: 12 }]), true);
  assert.equal(hasIncompleteRoom([{ name: 'Chambre Horizon', pricePerDay: 40, size: 0 }]), true);
  assert.equal(hasIncompleteRoom([{ name: 'Chambre Horizon', pricePerDay: 40, size: 12 }]), false);
});

test('requires at least one qualifying room option', () => {
  assert.equal(hasRoomWithoutOption([{ hasPrivateBath: false, hasDesk: false, hasLock: false, hasWardrobe: false }]), true);
  assert.equal(hasRoomWithoutOption([{ hasPrivateBath: false, hasDesk: true, hasLock: false, hasWardrobe: false }]), false);
});
