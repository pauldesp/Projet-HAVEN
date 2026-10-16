import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTACT_SUBJECTS, prepareContactRequest } from './contactRequest';
const form = { name: ' Camille Martin ', email: ' camille@example.test ', phone: ' 0612345678 ', subject: 'Avis sur le site', message: ' Le site est agréable à utiliser. ' };
test('les contacts couvrent avis, conseils, dysfonctionnements du site et réclamations sur le service', () => {
  for (const subject of CONTACT_SUBJECTS) {
    const request = prepareContactRequest({ ...form, subject }, 'contact-1', '2026-10-16T21:00:00Z');
    assert.equal(request.subject, subject);
    assert.equal(request.status, 'NEW');
    assert.equal(request.name, 'Camille Martin');
    assert.equal(request.email, 'camille@example.test');
    assert.equal(request.message, 'Le site est agréable à utiliser.');
    assert.equal(request.timestamp, '2026-10-16T21:00:00Z');
  }
});
test('aucun motif de contact ne propose de gérer une panne du logement ou un conflit', () => {
  for (const subject of ['Panne de chauffage', 'Conflit entre colocataires', 'Logement insalubre', 'Ménage non fait', 'Réservation']) {
    assert.throws(() => prepareContactRequest({ ...form, subject }, 'contact-1'), /propre formulaire/);
  }
});
test('les coordonnées et le message doivent être renseignés, les limites de stockage sont respectées', () => {
  for (const fields of [{ name: ' ' }, { email: 'invalide' }, { phone: '' }, { message: ' ' }, { name: 'x'.repeat(100) }, { message: 'x'.repeat(10000) }]) {
    assert.throws(() => prepareContactRequest({ ...form, ...fields }, 'contact-1'));
  }
});
