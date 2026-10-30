import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResidence, hasRequiredResidence, validResidenceDocument } from './residence';
import { publicTenantProfile } from './publicProfile';
import { UserRole, type User } from '../types';

test('a residence requires a complete normalized address and actual evidence before dossier review', () => {
  assert.deepEqual(normalizeResidence({ address: ' 12 rue Exemple ', postalCode: ' 17000 ', city: ' La Rochelle ', country: ' France ' }), { address: '12 rue Exemple', postalCode: '17000', city: 'La Rochelle', country: 'France' });
  assert.throws(() => normalizeResidence({ address: 'Example', city: '', country: 'France', postalCode: '17000' }));
  assert.equal(hasRequiredResidence({ residenceProvided: true, documents: {} }), false);
  assert.equal(hasRequiredResidence({ documents: { proofOfAddress: '/private' } }), false);
  assert.equal(hasRequiredResidence({ residenceProvided: true, documents: { proofOfAddress: '/private' } }), true);
});
test('residence evidence accepts supported formats only and caps the encoded file independently of identity storage', () => {
  assert.equal(validResidenceDocument('data:application/pdf;base64,QUJD'), true);
  assert.equal(validResidenceDocument('data:image/jpeg;base64,QUJD'), true);
  assert.equal(validResidenceDocument('data:image/svg+xml;base64,QUJD'), false);
  assert.equal(validResidenceDocument('https://untrusted.example/proof.pdf'), false);
  assert.equal(validResidenceDocument(`data:image/jpeg;base64,${'A'.repeat(851 * 1024)}`), false);
});
test('the public tenant profile never contains residence or proof information', () => {
  const profile = publicTenantProfile({ id: 'u', firstName: 'Camille', role: UserRole.TENANT, residenceProvided: true, residenceVerified: true, documents: { proofOfAddress: '/api/users/u/proof-of-address' } } as User);
  assert.equal('residenceProvided' in profile, false); assert.equal('documents' in profile, false);
});
