import test from 'node:test';
import assert from 'node:assert/strict';
import type { AdminAuditEntry, User, Listing } from '../types';
import { auditActionLabel, auditCategoryLabels, buildAuditTargetSnapshot, filterAuditEntries, initialAuditFilter, readableAuditSummary, resolveAuditTarget, type AuditContext } from './auditPresentation';
const entry: AdminAuditEntry = { id: 'event-1', actorId: 'admin-1', actorName: 'Paul Desplanques', category: 'ACCOUNT', action: 'USER_APPROVED', targetType: 'USER', targetId: 'user-1', summary: 'Statut du compte défini sur APPROVED.', createdAt: '2026-10-16T21:14:21Z' };
const context: AuditContext = { users: [{ id: 'user-1', firstName: 'Alice', lastName: 'Paquiet', email: 'alice@example.test' } as User], listings: [{ id: 'listing-1', title: 'Maison des Pins', city: 'La Rochelle' } as Listing], reports: [], incidents: [], contacts: [], bookings: [], legalDocs: [] };

test('les actions, catégories et résumés sont lisibles en français', () => {
  assert.equal(auditActionLabel('USER_APPROVED'), 'Profil validé');
  assert.equal(auditActionLabel('LISTING_REJECTED'), 'Annonce refusée');
  assert.equal(auditCategoryLabels.ACCOUNT, 'Comptes');
  assert.equal(readableAuditSummary(entry.summary), 'Statut du compte défini sur Validé.');
  assert.equal(auditActionLabel('FUTURE_UNKNOWN_ACTION'), 'Action administrative');
  assert.equal(entry.summary, 'Statut du compte défini sur APPROVED.');
});
test('les anciennes actions retrouvent la personne ou le logement sans modifier le journal', () => {
  const target = resolveAuditTarget(entry, context);
  assert.equal(target.label, 'Alice Paquiet');
  assert.equal(target.description, 'alice@example.test');
  assert.equal(target.historical, false);
  assert.equal(target.available, true);
  assert.equal(entry.targetLabel, undefined);
  assert.equal(resolveAuditTarget({ ...entry, targetType: 'LISTING', targetId: 'listing-1' }, context).label, 'Maison des Pins');
});
test('un nom enregistré au moment de l’action reste prioritaire sur la fiche actuelle', () => {
  const target = resolveAuditTarget({ ...entry, targetLabel: 'Alice Dupont', targetDescription: 'ancienne@example.test' }, context);
  assert.equal(target.label, 'Alice Dupont');
  assert.equal(target.description, 'ancienne@example.test');
  assert.equal(target.historical, true);
  assert.equal(resolveAuditTarget({ ...entry, targetLabel: 'Nom historique' }, context).description, '', 'aucun e-mail actuel n’est présenté comme un instantané historique');
  const missing = resolveAuditTarget({ ...entry, targetId: 'deleted', targetLabel: 'Ancien membre' }, context);
  assert.equal(missing.label, 'Ancien membre');
  assert.equal(missing.available, false);
  assert.equal(resolveAuditTarget({ ...entry, targetId: 'deleted' }, context).label, 'Profil indisponible');
});
test('les métadonnées enregistrées sont limitées au nom et au contexte utile', () => {
  const snapshot = buildAuditTargetSnapshot('USER', { firstName: 'Alice', lastName: 'Paquiet', email: 'alice@example.test', phone: '+33600000000', documents: { idCard: 'private' }, birthDate: '1998-01-01' });
  assert.deepEqual(snapshot, { targetLabel: 'Alice Paquiet', targetDescription: 'alice@example.test' });
  assert.deepEqual(buildAuditTargetSnapshot('LISTING', { title: 'Maison des Pins', city: 'La Rochelle' }), { targetLabel: 'Maison des Pins', targetDescription: 'La Rochelle' });
  assert.deepEqual(buildAuditTargetSnapshot('OTHER', { secret: 'private' }), {});
});
test('la recherche trouve noms, e-mails, administrateurs et actions françaises sans accents', () => {
  for (const query of ['alice', 'example.test', 'Paul', 'profil valide']) {
    assert.equal(filterAuditEntries([entry], { ...initialAuditFilter, query }, context).length, 1);
  }
  assert.equal(filterAuditEntries([entry], { ...initialAuditFilter, query: 'inexistant' }, context).length, 0);
});
test('les filtres se combinent et le journal reste trié du plus récent au plus ancien', () => {
  const older = { ...entry, id: 'older', createdAt: '2026-10-01T12:00:00Z' };
  const rows = [older, entry];
  assert.deepEqual(filterAuditEntries(rows, { ...initialAuditFilter, actorId: 'admin-1', category: 'ACCOUNT', action: 'USER_APPROVED', from: '2026-10-15', to: '2026-10-17' }, context).map(item => item.id), ['event-1']);
  assert.deepEqual(filterAuditEntries(rows, initialAuditFilter, context).map(item => item.id), ['event-1', 'older']);
  assert.equal(rows[0].id, 'older');
  assert.equal(filterAuditEntries(rows, { ...initialAuditFilter, category: 'LISTING' }, context).length, 0);
});
