import test from 'node:test';
import assert from 'node:assert/strict';
import type { Incident, Report } from '../types';
import { prepareReportFollowUp } from './reportFollowUp';
const incident = { id: 'incident-1', ownerId: 'owner-1', status: 'INVESTIGATING' } as Incident;
const report = { id: 'report-1', incidentId: 'incident-1', status: 'NEW' } as Report;
const now = '2026-10-16T21:40:00Z';

test('Haven peut laisser un incident ouvert au propriétaire sans clôturer le signalement', () => {
  const result = prepareReportFollowUp(report, incident, 'WAITING_OWNER', ' Intervention prévue demain. ', '2026-10-18', 'admin-1', now);
  assert.equal(result.reportUpdate.status, 'WAITING_OWNER');
  assert.equal(result.reportUpdate.ownerMessage, 'Intervention prévue demain.');
  assert.equal(result.reportUpdate.ownerReviewDate, '2026-10-18');
  assert.equal(result.reportUpdate.waitingOwnerSince, now);
  assert.equal(result.reportUpdate.handledBy, 'admin-1');
  assert.equal(result.incidentUpdate?.havenFollowUp.note, 'Intervention prévue demain.');
  assert.equal('status' in result.incidentUpdate!, false, 'l’admin ne modifie pas l’avancement géré par le propriétaire');
  assert.equal(incident.status, 'INVESTIGATING');
});
test('la date est facultative et ne provoque aucune reprise automatique', () => {
  const waiting = prepareReportFollowUp(report, incident, 'WAITING_OWNER', 'Le propriétaire intervient.', '', 'admin', now);
  assert.equal(waiting.reportUpdate.ownerReviewDate, null);
  const historical = { ...report, status: 'WAITING_OWNER', ownerReviewDate: '2026-10-17', waitingOwnerSince: now } as Report;
  assert.equal(historical.status, 'WAITING_OWNER');
  const resumed = prepareReportFollowUp(historical, incident, 'INVESTIGATING', 'Note interne', undefined, 'admin', '2026-10-20T12:00:00Z');
  assert.equal(resumed.reportUpdate.status, 'INVESTIGATING');
  assert.equal(resumed.reportUpdate.ownerReviewDate, null);
  assert.equal(resumed.incidentUpdate?.havenFollowUp.note, 'Haven a repris l’examen du signalement.');
  assert.doesNotMatch(resumed.incidentUpdate!.havenFollowUp.note, /Note interne/);
});
test('la temporisation exige un message et un incident ouvert avec propriétaire identifié', () => {
  for (const candidate of [undefined, { ...incident, id: 'other' }, { ...incident, ownerId: '' }, { ...incident, status: 'RESOLVED' }]) {
    assert.throws(() => prepareReportFollowUp(report, candidate as Incident | undefined, 'WAITING_OWNER', 'message', '', 'admin', now));
  }
  assert.throws(() => prepareReportFollowUp(report, incident, 'WAITING_OWNER', ' ', '', 'admin', now));
  assert.throws(() => prepareReportFollowUp(report, incident, 'WAITING_OWNER', 'x'.repeat(2001), '', 'admin', now));
});
test('les dates de réexamen impossibles ou passées sont refusées selon la date française', () => {
  for (const date of ['2026-02-30', '17/10/2026', '2026-10-15']) {
    assert.throws(() => prepareReportFollowUp(report, incident, 'WAITING_OWNER', 'message', date, 'admin', now));
  }
  assert.throws(() => prepareReportFollowUp(report, incident, 'WAITING_OWNER', 'message', '2026-10-16', 'admin', '2026-10-16T23:40:00Z'), /passée/);
});
test('les autres signalements gardent leurs actions habituelles et la clôture reste explicite', () => {
  const generic = { ...report, incidentId: undefined };
  const resolved = prepareReportFollowUp(generic, undefined, 'RESOLVED', undefined, undefined, 'admin', now);
  assert.equal(resolved.reportUpdate.status, 'RESOLVED');
  assert.equal(resolved.incidentUpdate, undefined);
  assert.throws(() => prepareReportFollowUp({ ...report, status: 'RESOLVED' }, incident, 'WAITING_OWNER', 'note', '', 'admin', now), /clôturé/);
  assert.throws(() => prepareReportFollowUp(report, incident, 'NEW', '', '', 'admin', now), /invalide/);
  assert.throws(() => prepareReportFollowUp(report, incident, ['WAITING_OWNER'], 'message', '', 'admin', now), /invalide/);
});
