import test from 'node:test';
import assert from 'node:assert/strict';
import { routeStayIssue, havenReportReason, bindStayIssueToBooking } from './stayIssueRouting';
import { prepareOwnerIncidentUpdate } from './ownerIncident';
import type { Incident } from '../types';
const issue = {
  id: 'issue-1', bookingId: 'booking-1', listingId: 'listing-1', ownerId: 'owner-1', reporterId: 'tenant-1',
  category: 'Chauffage / ventilation', subCategory: 'Radiateur ne chauffe pas', description: ' Le radiateur reste froid. ',
  photo: 'data:image/jpeg;base64,dGVzdA==', priority: 'HIGH' as const, createdAt: '2026-10-16T21:30:00Z'
};
test('une panne est adressée au propriétaire avec son séjour, sa photo et sa priorité', () => {
  const routed = routeStayIssue(issue);
  assert.equal(routed.destination, 'OWNER');
  if (routed.destination !== 'OWNER') return;
  assert.equal(routed.incident.ownerId, 'owner-1');
  assert.equal(routed.incident.bookingId, 'booking-1');
  assert.equal(routed.incident.status, 'NEW');
  assert.equal(routed.incident.priority, 'HIGH');
  assert.deepEqual(routed.incident.photos, ['data:image/jpeg;base64,dGVzdA==']);
  assert.equal(routed.incident.description, 'Le radiateur reste froid.');
});
test('conflit, insalubrité et ménage non fait sont des signalements pour Haven', () => {
  for (const category of [
    { category: 'Voisinage / vie en colocation', subCategory: 'Conflit entre colocataires' },
    { category: 'Nuisibles / hygiène', subCategory: 'Logement insalubre' },
    { category: 'Ménage / état du logement', subCategory: 'Ménage non fait' }
  ]) {
    const routed = routeStayIssue({ ...issue, ...category });
    assert.equal(routed.destination, 'HAVEN');
    if (routed.destination !== 'HAVEN') continue;
    assert.equal(routed.report.targetId, 'listing-1');
    assert.equal(routed.report.bookingId, 'booking-1');
    assert.equal(routed.report.status, 'NEW');
    assert.equal(routed.report.reason, 'OTHER');
    assert.deepEqual(routed.report.photos, ['data:image/jpeg;base64,dGVzdA==']);
    assert.match(routed.report.supportCategory!, new RegExp(category.subCategory));
  }
});
test('le manque de matériel de ménage reste un incident matériel pour le propriétaire', () => {
  assert.equal(routeStayIssue({ ...issue, category: 'Ménage / état du logement', subCategory: 'Manque de matériel de ménage' }).destination, 'OWNER');
});
test('aucun incident incomplet ne peut devenir silencieusement un signalement sans contexte', () => {
  for (const key of ['bookingId', 'listingId', 'ownerId', 'reporterId', 'category', 'subCategory', 'description']) {
    assert.throws(() => routeStayIssue({ ...issue, [key]: '' }), /obligatoires/);
  }
  for (const choice of ['CONFLICT', 'UNSANITARY', 'CLEANING']) assert.equal(havenReportReason(choice).reason, 'OTHER');
  assert.throws(() => havenReportReason('unknown'));
});
test('seul le propriétaire concerné peut prendre en charge et résoudre un incident', () => {
  const incident = { ownerId: 'owner-1', status: 'NEW' } as Incident;
  const progress = prepareOwnerIncidentUpdate(incident, 'owner-1', 'INVESTIGATING', ' Intervention demain ');
  assert.equal(progress.ownerNotes, 'Intervention demain');
  const resolved = prepareOwnerIncidentUpdate({ ...incident, status: 'INVESTIGATING' }, 'owner-1', 'RESOLVED', 'Réparé', '2026-10-16T21:50:00Z');
  assert.equal(resolved.resolvedAt, '2026-10-16T21:50:00Z');
  for (const actor of ['other-owner', 'tenant-1', 'admin-1']) assert.throws(() => prepareOwnerIncidentUpdate(incident, actor, 'RESOLVED', ''), /propriétaire/);
  assert.throws(() => prepareOwnerIncidentUpdate({ ...incident, status: 'RESOLVED' }, 'owner-1', 'INVESTIGATING', ''), /clôturé/);
  assert.throws(() => prepareOwnerIncidentUpdate(incident, 'owner-1', 'NEW', ''), /invalide/);
  assert.throws(() => prepareOwnerIncidentUpdate(incident, 'owner-1', 'RESOLVED', 'x'.repeat(2001)), /2 000/);
});

test('le destinataire et l’auteur sont issus de la réservation et ne peuvent pas être usurpés', () => {
  const booking = { tenantId: 'tenant-1', listingId: 'real-listing', ownerId: 'real-owner', status: 'CONFIRMED' };
  const bound = bindStayIssueToBooking(booking, 'tenant-1', { ...issue, ownerId: 'fake-owner', reporterId: 'fake-author' });
  assert.equal(bound.ownerId, 'real-owner');
  assert.equal(bound.reporterId, 'tenant-1');
  assert.equal(bound.listingId, 'real-listing');
  assert.throws(() => bindStayIssueToBooking(booking, 'other-user', issue), /locataire/);
  assert.throws(() => bindStayIssueToBooking({ ...booking, status: 'CANCELLED' }, 'tenant-1', issue), /séjour/);
});
