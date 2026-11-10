import test from 'node:test';
import assert from 'node:assert/strict';
import { nextTaskHealth, shouldAlert } from './systemHealth';
import { taskStatus } from './adminMonitoring';

test('trois échecs de suite déclenchent une seule alerte, une réussite remet à zéro', () => {
  let health = nextTaskHealth(undefined, 'MAIL_DELIVERY', false, 'Resend indisponible', '2026-11-11T10:00:00Z');
  health = nextTaskHealth(health, 'MAIL_DELIVERY', false, 'Resend indisponible', '2026-11-11T10:00:30Z');
  assert.equal(shouldAlert(health), false);
  health = nextTaskHealth(health, 'MAIL_DELIVERY', false, 'Resend indisponible', '2026-11-11T10:01:00Z');
  assert.equal(shouldAlert(health), true);
  assert.equal(shouldAlert({ ...health, alertedAt: '2026-11-11T10:01:00Z' }), false);
  health = nextTaskHealth({ ...health, alertedAt: 'x' }, 'MAIL_DELIVERY', true, undefined, '2026-11-11T10:01:30Z');
  assert.equal(health.consecutiveFailures, 0);
  assert.equal(health.alertedAt, undefined);
});

test('l’état affiché distingue échec, retard et fonctionnement normal', () => {
  const now = Date.parse('2026-11-11T12:00:00Z');
  assert.equal(taskStatus('MAIL_DELIVERY', undefined, now).tone, 'idle');
  assert.equal(taskStatus('MAIL_DELIVERY', { task: 'MAIL_DELIVERY', lastRunAt: '2026-11-11T11:59:00Z', lastSuccessAt: '2026-11-11T11:59:00Z', consecutiveFailures: 0 }, now).tone, 'ok');
  assert.equal(taskStatus('MAIL_DELIVERY', { task: 'MAIL_DELIVERY', lastRunAt: '2026-11-11T11:00:00Z', lastSuccessAt: '2026-11-11T11:00:00Z', consecutiveFailures: 0 }, now).tone, 'warning');
  assert.equal(taskStatus('MAIL_DELIVERY', { task: 'MAIL_DELIVERY', lastRunAt: '2026-11-11T11:59:00Z', consecutiveFailures: 3 }, now).tone, 'error');
});
