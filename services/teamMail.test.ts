import test from 'node:test';
import assert from 'node:assert/strict';
import { teamMailDisposition, teamMailRecipient, teamMailValues, teamReportMailJob, teamReportToAnnounce, TEAM_ALERTS_START } from './teamMail';
import type { Report } from '../types';

const at = '2026-11-11T09:00:00.000Z';
const report = { id: 'r1', reporterId: 't', targetId: 'l', targetType: 'LISTING', reason: 'INACCURATE', description: 'Les photos ne correspondent pas', status: 'NEW', timestamp: at } as Report;

test('chaque nouveau signalement est annoncé une seule fois à l’équipe, sans rappeler les anciens', () => {
  assert.equal(teamReportToAnnounce(report), true);
  assert.equal(teamReportToAnnounce({ ...report, teamMailQueuedAt: at }), false);
  assert.equal(teamReportToAnnounce({ ...report, status: 'RESOLVED' } as Report), false);
  assert.equal(teamReportToAnnounce({ ...report, timestamp: '2026-11-01T09:00:00.000Z' }), false);
  assert.ok(TEAM_ALERTS_START < at);
});

test('le type de signalement et le motif sont lisibles pour l’équipe', () => {
  const job = teamReportMailJob(report, at);
  assert.equal(teamMailValues(job, { report }).TYPE_SIGNALEMENT, 'Signalement d’annonce');
  assert.equal(teamMailValues(job, { report }).MOTIF_SIGNALEMENT, 'Annonce mensongère ou inexacte');
  assert.equal(teamMailValues(job, { report: { ...report, incidentId: 'i1', bookingId: 'b1' } }).TYPE_SIGNALEMENT, 'Demande d’intervention sur un incident');
  assert.equal(teamMailValues(job, { report: { ...report, bookingId: 'b1', supportCategory: 'Ménage non fait' } }).MOTIF_SIGNALEMENT, 'Ménage non fait');
});

test('l’adresse de l’équipe a une valeur de repli, et sans adresse rien ne part', () => {
  assert.equal(teamMailRecipient({ HAVEN_TEAM_EMAIL: ' equipe@haven.test ', EMAIL_REPLY_TO: 'contact@haven.test' }), 'equipe@haven.test');
  assert.equal(teamMailRecipient({ EMAIL_REPLY_TO: '', RESEND_TEST_EMAIL_TO: 'paul@haven.test' }), 'paul@haven.test');
  assert.equal(teamMailDisposition(teamReportMailJob(report, at), { report }, '', Date.parse(at)), 'CANCELLED');
  assert.equal(teamMailDisposition(teamReportMailJob(report, at), { report }, 'equipe@haven.test', Date.parse(at)), 'SEND');
});
