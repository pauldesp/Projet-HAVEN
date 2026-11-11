import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, mergeErrorGroup, prepareErrorReport, scrub, shouldAlert } from './errorTracking';

test('aucune donnée personnelle ni secret n’est conservé', () => {
  const cleaned = scrub('Échec pour paul@example.com avec sk_test_abc123 sur /#/payment/b-1?token=xyz et carte 4242424242424242');
  assert.ok(!cleaned.includes('paul@example.com'));
  assert.ok(!cleaned.includes('sk_test_abc123'));
  assert.ok(!cleaned.includes('token=xyz'));
  assert.ok(!cleaned.includes('4242424242424242'));
});

test('une même erreur sur deux réservations différentes forme un seul groupe', () => {
  const a = fingerprint('CLIENT', 'Booking b-9094f821c5d228f3 not found', 'TypeError\n    at load (/pages/A.tsx:12:5)');
  const b = fingerprint('CLIENT', 'Booking b-aaef5ca0c028eaa2 not found', 'TypeError\n    at load (/pages/A.tsx:14:9)');
  assert.equal(a, b);
  assert.notEqual(a, fingerprint('SERVER', 'Booking b-9094f821c5d228f3 not found'));
});

test('le bruit réseau et les extensions sont ignorés', () => {
  assert.equal(prepareErrorReport({ source: 'CLIENT', message: 'TypeError: Failed to fetch' }), null);
  assert.equal(prepareErrorReport({ source: 'SERVER', message: 'read ECONNRESET' }), null);
  assert.equal(prepareErrorReport({ source: 'CLIENT', message: 'ResizeObserver loop limit exceeded' }), null);
  assert.equal(prepareErrorReport({ source: 'OTHER' as never, message: 'x' }), null);
  assert.equal(prepareErrorReport({ source: 'CLIENT', message: 'x', userAgent: 'Mozilla/5.0 (iPhone) AppleWebKit Version/18 Mobile Safari/604.1' })?.browser, 'Safari iPhone');
});

test('une erreur est comptée, et une erreur résolue qui revient est rouverte et signalée', () => {
  const report = prepareErrorReport({ source: 'CLIENT', message: 'Cannot read properties of undefined' })!;
  const first = mergeErrorGroup(undefined, report, '2026-11-11T10:00:00Z');
  assert.equal(first.isNew, true);
  const again = mergeErrorGroup(first.group, report, '2026-11-11T11:00:00Z');
  assert.equal(again.isNew, false);
  assert.equal(again.group.count, 2);
  const back = mergeErrorGroup({ ...again.group, status: 'RESOLVED', resolvedAt: '2026-11-11T12:00:00Z' }, report, '2026-11-12T09:00:00Z');
  assert.equal(back.isNew, true);
  assert.equal(back.group.status, 'OPEN');
  assert.equal(back.group.resolvedAt, undefined);
  assert.equal(shouldAlert(true, 10), false, 'au plus 10 alertes par heure');
});
