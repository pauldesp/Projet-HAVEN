import test from 'node:test';
import assert from 'node:assert/strict';
import type { Booking } from '../types';
import { DAMAGE_DEPOSIT_POLICY, DamageClaimError, assertDamageDepositAccepted, canDeclareDamage, damageClaimDeadline, validateDamageClaimInput, validateDamageDecision, validateDamageResponse } from './damageDeposit';

const photo = `data:image/webp;base64,${'A'.repeat(400)}`;
const booking = (changes: Partial<Booking> = {}) => ({
  id: 'b1', listingId: 'l1', roomId: 'r1', tenantId: 't1', ownerId: 'o1', startDate: '2026-12-01', endDate: '2026-12-10', status: 'COMPLETED',
  basePrice: 300, cleaningFee: 30, platformFee: 45, totalPrice: 375, createdAt: '2026-11-01T10:00:00.000Z', paymentStatus: 'PAID',
  depositConsent: { version: DAMAGE_DEPOSIT_POLICY.version, text: '…', amountCents: DAMAGE_DEPOSIT_POLICY.amountCents, acceptedAt: '2026-11-01T10:00:00.000Z' },
  ...changes,
}) as Booking;

test('the tenant must accept the current deposit terms to book', () => {
  assert.doesNotThrow(() => assertDamageDepositAccepted(DAMAGE_DEPOSIT_POLICY.version));
  assert.throws(() => assertDamageDepositAccepted(undefined), DamageClaimError);
  assert.throws(() => assertDamageDepositAccepted('haven-deposit-v0'), DamageClaimError);
});

test('damage can be declared from the departure day to 7 days after, inclusive', () => {
  assert.equal(damageClaimDeadline(booking()), '2026-12-17');
  assert.equal(canDeclareDamage(booking(), '2026-12-09'), false);
  assert.equal(canDeclareDamage(booking(), '2026-12-10'), true);
  assert.equal(canDeclareDamage(booking(), '2026-12-17'), true);
  assert.equal(canDeclareDamage(booking(), '2026-12-18'), false);
  assert.equal(damageClaimDeadline(booking({ endDate: '2026-12-28' })), '2027-01-04');
});

test('only paid, non-cancelled stays booked with the deposit can lead to a claim', () => {
  assert.equal(canDeclareDamage(booking({ status: 'CANCELLED' }), '2026-12-11'), false);
  assert.equal(canDeclareDamage(booking({ paymentStatus: 'PENDING' }), '2026-12-11'), false);
  assert.equal(canDeclareDamage(booking({ depositConsent: undefined }), '2026-12-11'), false);
  assert.equal(canDeclareDamage(booking({ status: 'CONFIRMED' }), '2026-12-11'), true);
});

test('the owner asks for at most the deposit, with a description and at least one photo', () => {
  const valid = { amountCents: 8500, description: 'Porte de placard arrachée, devis joint de 85 €.', photos: [photo] };
  assert.deepEqual(validateDamageClaimInput(valid), valid);
  assert.throws(() => validateDamageClaimInput({ ...valid, amountCents: DAMAGE_DEPOSIT_POLICY.amountCents + 1 }), /entre 1 €/);
  assert.throws(() => validateDamageClaimInput({ ...valid, amountCents: 50 }), /entre 1 €/);
  assert.throws(() => validateDamageClaimInput({ ...valid, amountCents: 85.5 }), /entre 1 €|valide/);
  assert.throws(() => validateDamageClaimInput({ ...valid, description: 'Cassé' }), /Décrivez/);
  assert.throws(() => validateDamageClaimInput({ ...valid, photos: [] }), /photos/);
  assert.throws(() => validateDamageClaimInput({ ...valid, photos: ['https://example.com/a.jpg'] }), /pas valide/);
  assert.throws(() => validateDamageClaimInput({ ...valid, photos: Array(7).fill(photo) }), /photos/);
});

test('Haven never charges more than requested nor more than the deposit, and always explains', () => {
  const claim = { status: 'SUBMITTED' as const, requestedCents: 8500 };
  assert.deepEqual(validateDamageDecision(claim, { decision: 'APPROVE', amountCents: 6000, note: 'Usure partielle déduite.' }), { decision: 'APPROVE', amountCents: 6000, note: 'Usure partielle déduite.' });
  assert.throws(() => validateDamageDecision(claim, { decision: 'APPROVE', amountCents: 9000, note: 'Trop' }), /compris entre/);
  assert.throws(() => validateDamageDecision(claim, { decision: 'APPROVE', amountCents: 6000, note: '' }), /Expliquez/);
  assert.equal(validateDamageDecision(claim, { decision: 'REJECT', note: 'Déjà présent à l’entrée.' }).amountCents, 0);
  assert.throws(() => validateDamageDecision({ ...claim, status: 'CHARGED' }, { decision: 'REJECT', note: 'Déjà traité' }), /déjà été traitée/);
});

test('the tenant answer is a short text', () => {
  assert.equal(validateDamageResponse('  La rayure était déjà là.  '), 'La rayure était déjà là.');
  assert.throws(() => validateDamageResponse('non'), DamageClaimError);
});
