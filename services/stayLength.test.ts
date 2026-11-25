import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_STAY_NIGHTS, addNights, longestContinuousNights } from './stay';
import { validateSeriesStays } from './recurringInstallments';

test('the longest stay allowed is 90 nights', () => {
  assert.equal(MAX_STAY_NIGHTS, 90);
  assert.equal(addNights('2027-01-01', 90), '2027-04-01');
});

test('stays that follow each other without a night off form one continuous stay', () => {
  assert.equal(longestContinuousNights([{ startDate: '2027-01-01', endDate: '2027-01-11' }, { startDate: '2027-01-11', endDate: '2027-01-21' }]), 20);
  assert.equal(longestContinuousNights([{ startDate: '2027-01-01', endDate: '2027-01-11' }, { startDate: '2027-01-12', endDate: '2027-01-21' }]), 10, 'une nuit d’écart coupe le séjour');
  assert.equal(longestContinuousNights([{ startDate: '2027-02-01', endDate: '2027-02-05' }, { startDate: '2027-01-01', endDate: '2027-02-01' }]), 35, 'ordre indifférent');
  assert.equal(longestContinuousNights([]), 0);
});

const now = new Date('2026-12-01T10:00:00Z');
const stay = (id: string, startDate: string, endDate: string) => ({ id, roomId: 'room-1', startDate, endDate });

test('a stay of a series cannot exceed 90 nights', () => {
  assert.equal(validateSeriesStays([stay('a', '2027-01-01', '2027-04-01'), stay('b', '2027-06-01', '2027-06-10')], now), null, '90 nuits pile');
  assert.match(validateSeriesStays([stay('a', '2027-01-01', '2027-04-02'), stay('b', '2027-06-01', '2027-06-10')], now) || '', /90 nuits/);
});

test('stays of a series that follow each other cannot exceed 90 nights together', () => {
  assert.match(validateSeriesStays([stay('a', '2027-01-01', '2027-03-01'), stay('b', '2027-03-01', '2027-04-15')], now) || '', /90 nuits/);
  assert.equal(validateSeriesStays([stay('a', '2027-01-01', '2027-03-01'), stay('b', '2027-03-02', '2027-04-15')], now), null);
});
