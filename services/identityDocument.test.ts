import test from 'node:test';
import assert from 'node:assert/strict';
import { hasCompleteIdentityDocument, isTwoSidedIdentityDocument } from './profileVerification';

const front = 'data:image/jpeg;base64,AAAA';

test('an identity card or a residence permit needs both sides', () => {
  for (const idDocumentType of ['ID_CARD', 'RESIDENCE_PERMIT']) {
    assert.equal(isTwoSidedIdentityDocument(idDocumentType), true);
    assert.equal(hasCompleteIdentityDocument({ idCard: front, idDocumentType }), false);
    assert.equal(hasCompleteIdentityDocument({ idCard: front, idDocumentType, idCardBack: 'STORED' }), true);
    assert.equal(hasCompleteIdentityDocument({ idDocumentType, idCardBack: 'STORED' }), false);
  }
});

test('a passport needs only its photo page', () => {
  assert.equal(isTwoSidedIdentityDocument('PASSPORT'), false);
  assert.equal(hasCompleteIdentityDocument({ idCard: front, idDocumentType: 'PASSPORT' }), true);
});

test('accounts created before the two sides keep their single file', () => {
  assert.equal(hasCompleteIdentityDocument({ idCard: front }), true);
  assert.equal(hasCompleteIdentityDocument({}), false);
  assert.equal(hasCompleteIdentityDocument(null), false);
});
