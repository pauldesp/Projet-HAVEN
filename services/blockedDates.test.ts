import test from 'node:test';
import assert from 'node:assert/strict';
import { blockedRanges, datesBetween, withoutDates } from './blockedDates';

test('une période bloquée couvre chaque nuit, fin incluse, y compris en changeant de mois', () => {
  assert.deepEqual(datesBetween('2026-11-29', '2026-12-02'), ['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02']);
});

test('les nuits bloquées se regroupent en périodes lisibles', () => {
  assert.deepEqual(blockedRanges(['2026-12-02', '2026-12-01', '2026-12-05', '2026-12-01']), [
    { start: '2026-12-01', end: '2026-12-02', nights: 2 }, { start: '2026-12-05', end: '2026-12-05', nights: 1 }]);
  assert.deepEqual(withoutDates(['2026-12-01', '2026-12-02', '2026-12-05'], ['2026-12-01', '2026-12-02']), ['2026-12-05']);
});
