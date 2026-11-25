import assert from 'node:assert/strict';
import test from 'node:test';
import { hostStatusLabel, isTaxProfileComplete, isValidSiret, isValidSiren, maskedTaxProfile, normalizeTaxProfile } from './ownerTaxProfile';

const address = { street: '12 rue Exemple', postalCode: '17000', city: 'La Rochelle', country: 'FR' };

test('SIREN and SIRET numbers are checked', () => {
  assert.equal(isValidSiren('732829320'), true);
  assert.equal(isValidSiren('732829321'), false);
  assert.equal(isValidSiret('73282932000074'), true);
  assert.equal(isValidSiret('73282932000075'), false);
  assert.equal(isValidSiret('123'), false);
});

test('a private host gives a tax number, a birth date and an address', () => {
  const profile = normalizeTaxProfile({ status: 'PARTICULIER', nif: '1 23 45 678 901 23', birthDate: '1980-04-02', address }, '2026-11-25T10:00:00Z');
  assert.deepEqual(profile, { status: 'PARTICULIER', address, updatedAt: '2026-11-25T10:00:00Z', nif: '1234567890123', nifCountry: 'FR', birthDate: '1980-04-02' });
  assert.equal(isTaxProfileComplete(profile), true);
  assert.equal(maskedTaxProfile(profile).nif, '•••••••••0123');
  assert.throws(() => normalizeTaxProfile({ status: 'PARTICULIER', nif: '9234567890123', birthDate: '1980-04-02', address }), /13 chiffres/);
  assert.throws(() => normalizeTaxProfile({ status: 'PARTICULIER', nif: '1234567890123', address }), /date de naissance/);
});

test('a professional host gives a valid SIRET; a company its name instead of personal details', () => {
  const company = normalizeTaxProfile({ status: 'PROFESSIONNEL', legalForm: 'SOCIETE', siret: '732 829 320 00074', companyName: 'Colocs SAS', address });
  assert.equal(company.siren, '732829320');
  assert.equal(company.nif, undefined);
  const soleTrader = normalizeTaxProfile({ status: 'PROFESSIONNEL', legalForm: 'INDIVIDUEL', siret: '73282932000074', nif: '0123456789012', birthDate: '1975-01-01', address });
  assert.equal(soleTrader.birthDate, '1975-01-01');
  assert.throws(() => normalizeTaxProfile({ status: 'PROFESSIONNEL', legalForm: 'SOCIETE', siret: '73282932000075', companyName: 'X', address }), /SIRET/);
  assert.throws(() => normalizeTaxProfile({ status: 'PROFESSIONNEL', siret: '73282932000074', address }), /société/);
});

test('missing details keep payouts waiting', () => {
  assert.equal(isTaxProfileComplete(undefined), false);
  assert.equal(isTaxProfileComplete({ status: 'PARTICULIER', address }), false);
  assert.throws(() => normalizeTaxProfile({ status: 'PARTICULIER', nif: '1234567890123', birthDate: '1980-04-02', address: { ...address, city: '' } }), /adresse/);
});

test('listings show the host status', () => {
  assert.equal(hostStatusLabel('PARTICULIER'), 'Hôte particulier');
  assert.equal(hostStatusLabel('PROFESSIONNEL'), 'Hôte professionnel');
  assert.equal(hostStatusLabel(null), null);
});
