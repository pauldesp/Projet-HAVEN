import assert from 'node:assert/strict';
import test from 'node:test';
import { createOccupantToken, hashOccupantToken, isWellFormedOccupantToken, occupantAccessExpiry, occupantAccessProblem, occupantAccessRecord } from './occupantAccess';
import type { Booking } from '../types';

const booking = { id: 'b1', tenantId: 't1', ownerId: 'o1', listingId: 'l1', roomId: 'r1', startDate: '2027-01-10', endDate: '2027-01-20', status: 'CONFIRMED', paymentStatus: 'PAID',
  occupant: { firstName: 'Tom', lastName: 'Durand', birthDate: '2009-01-01', email: 'tom@example.com', phone: '+33612345678', minor: true } } as unknown as Booking;

test('a stay link is long, random and stored only as a hash', () => {
  const token = createOccupantToken();
  assert.equal(isWellFormedOccupantToken(token), true);
  assert.notEqual(createOccupantToken(), token);
  assert.match(hashOccupantToken(token), /^[a-f0-9]{64}$/);
  assert.equal(hashOccupantToken(token).includes(token), false);
  assert.equal(isWellFormedOccupantToken('court'), false);
});

test('the link opens the stay until 7 days after departure', () => {
  assert.equal(occupantAccessExpiry('2027-01-20'), '2027-01-27T23:59:59.000Z');
  const access = occupantAccessRecord(booking, '2027-01-01T10:00:00Z');
  assert.equal(occupantAccessProblem(access, booking, Date.parse('2027-01-27T20:00:00Z')), null);
  assert.match(occupantAccessProblem(access, booking, Date.parse('2027-01-28T01:00:00Z')) || '', /expiré/);
});

test('a cancelled, unpaid or other stay does not open', () => {
  const access = occupantAccessRecord(booking, '2027-01-01T10:00:00Z');
  const at = Date.parse('2027-01-12T10:00:00Z');
  assert.match(occupantAccessProblem(access, { ...booking, status: 'CANCELLED' }, at) || '', /annulé/);
  assert.match(occupantAccessProblem(access, { ...booking, paymentStatus: 'PENDING' }, at) || '', /pas encore confirmé/);
  assert.match(occupantAccessProblem(access, { ...booking, id: 'b2' }, at) || '', /pas valide/);
  assert.match(occupantAccessProblem(access, { ...booking, occupant: undefined }, at) || '', /pas valide/);
  assert.match(occupantAccessProblem(undefined, booking, at) || '', /pas valide/);
});
