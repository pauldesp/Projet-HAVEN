import test from 'node:test';
import assert from 'node:assert/strict';
import type { Incident } from '../types';
import { filterAndSortIncidents, initialIncidentFilter, prepareIncidentEscalation } from './incidentMonitoring';
import { prepareOwnerIncidentUpdate } from './ownerIncident';
const first = { id: 'old', ownerId: 'owner-1', reporterId: 'tenant-1', bookingId: 'booking-1', listingId: 'listing-1', title: 'Électricité', description: 'Prise défectueuse', createdAt: '2026-10-01T12:00:00Z', status: 'NEW', priority: 'LOW' } as Incident;
const rows: Incident[] = [
  first,
  { ...first, id: 'progress', status: 'INVESTIGATING', priority: 'HIGH', createdAt: '2026-10-10T12:00:00Z', ownerId: 'owner-2', listingId: 'listing-2', escalatedAt: '2026-10-12T12:00:00Z' },
  { ...first, id: 'resolved-old', status: 'RESOLVED', resolvedAt: '2026-10-02T12:00:00Z' },
  { ...first, id: 'resolved-new', status: 'RESOLVED', resolvedAt: '2026-10-14T12:00:00Z' },
  { ...first, id: 'legacy-resolved', status: 'RESOLVED' }
];
test('les filtres distinguent incidents ouverts, en cours, résolus et signalés à Haven', () => {
  assert.deepEqual(filterAndSortIncidents(rows, initialIncidentFilter).map(row => row.id), ['old', 'progress']);
  assert.deepEqual(filterAndSortIncidents(rows, { ...initialIncidentFilter, status: 'INVESTIGATING' }).map(row => row.id), ['progress']);
  assert.equal(filterAndSortIncidents(rows, { ...initialIncidentFilter, status: 'RESOLVED' }).length, 3);
  assert.deepEqual(filterAndSortIncidents(rows, { ...initialIncidentFilter, status: 'ESCALATED' }).map(row => row.id), ['progress']);
  assert.equal(first.escalatedAt, undefined, 'un incident ancien ne déclenche aucun signalement automatique');
});
test('recherche sans accents, dates et filtres logement/propriétaire se combinent', () => {
  const result = filterAndSortIncidents(rows, { ...initialIncidentFilter, search: 'electricite', from: '2026-10-09', to: '2026-10-11', ownerId: 'owner-2', listingId: 'listing-2' });
  assert.deepEqual(result.map(row => row.id), ['progress']);
  assert.equal(filterAndSortIncidents(rows, { ...initialIncidentFilter, search: 'Alice' }, () => 'Alice Martin').length, 2);
  assert.equal(filterAndSortIncidents(rows, { ...initialIncidentFilter, ownerId: 'unknown' }).length, 0);
});
test('les tris gèrent ancienneté, priorité et dates de résolution absentes sans modifier la source', () => {
  assert.equal(filterAndSortIncidents(rows, { ...initialIncidentFilter, sort: 'NEWEST' })[0].id, 'progress');
  assert.equal(filterAndSortIncidents(rows, { ...initialIncidentFilter, sort: 'PRIORITY' })[0].id, 'progress');
  assert.deepEqual(filterAndSortIncidents(rows, { ...initialIncidentFilter, status: 'RESOLVED', sort: 'RESOLVED' }).map(row => row.id), ['resolved-new', 'resolved-old', 'legacy-resolved']);
  assert.equal(rows[0], first);
});
test('le jour de fin inclut toute la journée lors du passage à l’heure d’hiver', () => {
  const previous = process.env.TZ; process.env.TZ = 'Europe/Paris';
  try {
    const incident = { ...first, createdAt: '2026-10-25T23:30:00+01:00' };
    assert.equal(filterAndSortIncidents([incident], { ...initialIncidentFilter, to: '2026-10-25' }).length, 1);
    assert.equal(filterAndSortIncidents([{ ...incident, createdAt: '2026-10-26T00:00:00+01:00' }], { ...initialIncidentFilter, to: '2026-10-25' }).length, 0);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
test('prise en charge et résolution conservent les dates réelles de chaque étape', () => {
  const start = prepareOwnerIncidentUpdate(first, 'owner-1', 'INVESTIGATING', '', '2026-10-16T12:00:00Z');
  const end = prepareOwnerIncidentUpdate({ ...first, ...start }, 'owner-1', 'RESOLVED', 'Réparé', '2026-10-17T12:00:00Z');
  assert.equal(end.takenInChargeAt, '2026-10-16T12:00:00Z');
  assert.equal(end.resolvedAt, '2026-10-17T12:00:00Z');
});
test('une intervention de Haven est volontaire, liée à l’incident et ne clôture pas sa gestion propriétaire', () => {
  const result = prepareIncidentEscalation(first, 'tenant-1', ' Le problème persiste malgré ma relance. ', 'incident_old', '2026-10-16T12:00:00Z');
  assert.equal(result.report.incidentId, first.id);
  assert.equal(result.report.bookingId, first.bookingId);
  assert.equal(result.report.status, 'NEW');
  assert.match(result.report.description, /problème persiste/);
  assert.equal(result.update.escalatedAt, '2026-10-16T12:00:00Z');
  assert.equal(result.update.status, undefined);
  assert.equal(first.escalatedAt, undefined);
  for (const actor of ['owner-1', 'admin-1', 'other-tenant']) assert.throws(() => prepareIncidentEscalation(first, actor, 'motif', 'report'), /auteur/);
  assert.throws(() => prepareIncidentEscalation(first, 'tenant-1', ' ', 'report'), /Expliquez/);
  assert.throws(() => prepareIncidentEscalation({ ...first, status: 'RESOLVED' }, 'tenant-1', 'motif', 'report'), /clôturé/);
});
