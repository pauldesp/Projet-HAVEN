import assert from 'node:assert/strict';
import test from 'node:test';
import { GUARDIAN_DECLARATION_VERSION, normalizeOccupant } from './occupant';
import { OCCUPANT_RESIDENCE_DECLARATION_VERSION, RESIDENCE_DECLARATION_VERSION, assertResidenceDeclared, residenceDeclarationRecord } from './residenceDeclaration';

const pdf = 'data:application/pdf;base64,JVBERi0xLjQK';
const adult = { firstName: ' Léa ', lastName: 'Martin', birthDate: '2000-05-10', email: 'Lea.Martin@example.com', phone: '06 12 34 56 78' };

test('an adult occupant is stored with a normalised e-mail and phone', () => {
  assert.deepEqual(normalizeOccupant(adult, '2027-01-10'), { firstName: 'Léa', lastName: 'Martin', birthDate: '2000-05-10', email: 'lea.martin@example.com', phone: '+33612345678', minor: false });
});

test('the occupant must be at least 16 on the day of arrival', () => {
  assert.throws(() => normalizeOccupant({ ...adult, birthDate: '2011-01-11' }, '2027-01-10'), /au moins 16 ans/);
  assert.equal(normalizeOccupant({ ...adult, birthDate: '2011-01-10' }, '2027-01-10', { guardianDeclarationVersion: GUARDIAN_DECLARATION_VERSION, parentalAuthorization: pdf }).minor, true, '16 ans le jour même');
});

test('a minor occupant needs the legal representative declaration and a parental authorization', () => {
  const minor = { ...adult, birthDate: '2010-03-01' };
  assert.throws(() => normalizeOccupant(minor, '2027-01-10'), /représentant légal/);
  assert.throws(() => normalizeOccupant(minor, '2027-01-10', { guardianDeclarationVersion: GUARDIAN_DECLARATION_VERSION }), /autorisation parentale/);
  assert.throws(() => normalizeOccupant(minor, '2027-01-10', { guardianDeclarationVersion: GUARDIAN_DECLARATION_VERSION, parentalAuthorization: 'data:text/html;base64,AAAA' }), /autorisation parentale/);
  const saved = normalizeOccupant(minor, '2027-01-10', { guardianDeclarationVersion: GUARDIAN_DECLARATION_VERSION, parentalAuthorization: pdf });
  assert.equal(saved.minor, true);
  assert.equal(saved.parentalAuthorization, true);
  assert.equal('dataUrl' in saved, false, 'le document n’est pas copié dans la réservation');
});

test('identity, e-mail and phone of the occupant are required', () => {
  assert.throws(() => normalizeOccupant({ ...adult, firstName: '' }, '2027-01-10'), /prénom et le nom/);
  assert.throws(() => normalizeOccupant({ ...adult, email: 'pas-un-mail' }, '2027-01-10'), /e-mail/);
  assert.throws(() => normalizeOccupant({ ...adult, phone: '12' }, '2027-01-10'), /téléphone/);
  assert.throws(() => normalizeOccupant(adult, '2027-01-10', { bookerEmail: 'lea.martin@example.com' }), /différente de la vôtre/);
});

test('booking for someone else uses the occupant wording of the main residence declaration', () => {
  assert.throws(() => assertResidenceDeclared(RESIDENCE_DECLARATION_VERSION, true), /résidence principale/);
  assert.doesNotThrow(() => assertResidenceDeclared(OCCUPANT_RESIDENCE_DECLARATION_VERSION, true));
  assert.match(residenceDeclarationRecord('2026-11-25T10:00:00Z', true).text, /^Je déclare que l’occupant dispose/);
});
