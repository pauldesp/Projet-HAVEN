import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMemberApproval, prepareMemberModeration } from './memberApproval';

const submitted = {
  role: 'TENANT', status: 'PENDING', firstName: 'Camille', lastName: 'Martin',
  birthDate: '1998-02-14', phone: '+33612345678', phoneVerified: false,
  emailVerified: true, identityVerified: false, legalAccepted: true,
  documents: { idCard: 'data:image/jpeg;base64,example' }, verificationSubmittedAt: '2026-10-16T20:00:00.000Z'
};
test('une décision admin valide ensemble identité et compte sans exiger de SMS', () => {
  const approval = prepareMemberApproval(submitted, 'admin-1', '2026-10-16T21:00:00.000Z');
  assert.equal(approval.status, 'APPROVED');
  assert.equal(approval.identityVerified, true);
  assert.equal(approval.isVerified, true);
  assert.equal(approval.approvedBy, 'admin-1');
  assert.equal(approval.idVerifiedAt, approval.approvedAt);
  assert.equal(approval.rejectionReason, null);
});
test('aucun critère du dossier ne peut être ignoré par la validation admin', () => {
  for (const missing of [{ verificationSubmittedAt: null }, { documents: {} }, { emailVerified: false }, { legalAccepted: false }, { phone: '' }]) {
    assert.throws(() => prepareMemberApproval({ ...submitted, ...missing }, 'admin-1'), /dossier/);
  }
  assert.throws(() => prepareMemberApproval({ ...submitted, role: 'ADMIN' }, 'admin-1'), /gouvernance/);
});

test('refus et bannissement sont distincts, motivés et retirent la validation', () => {
  for (const status of ['REJECTED', 'BANNED']) {
    const result = prepareMemberModeration(submitted, status, ' Document illisible ', 'admin-1');
    assert.equal(result.status, status);
    assert.equal(result.rejectionReason, 'Document illisible');
    assert.equal(result.identityVerified, false);
    assert.equal(result.verificationSubmittedAt, null);
    assert.equal(result.moderatedBy, 'admin-1');
  }
  assert.throws(() => prepareMemberModeration(submitted, 'APPROVED', 'motif', 'admin-1'));
  assert.throws(() => prepareMemberModeration(submitted, 'BANNED', ' ', 'admin-1'));
  assert.throws(() => prepareMemberModeration({ role: 'ADMIN' }, 'BANNED', 'motif', 'admin-1'));
});
