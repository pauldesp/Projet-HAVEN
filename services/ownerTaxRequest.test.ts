import assert from 'node:assert/strict';
import test from 'node:test';
import { daysLeft, dueReminder, newTaxRequest, taxHoldsPayouts } from './ownerTaxRequest';

const at = '2027-01-01T10:00:00.000Z';
const day = (n: number) => Date.parse(at) + n * 86400_000;

test('the request starts with the first paid booking and gives 60 days', () => {
  const request = newTaxRequest('o', at);
  assert.equal(request.deadlineAt, '2027-03-02T10:00:00.000Z');
  assert.equal(request.nextReminderAt, '2027-01-21T10:00:00.000Z');
  assert.equal(daysLeft(request, day(10)), 50);
});

test('two reminders, at 20 and 40 days, then nothing more', () => {
  let request = newTaxRequest('o', at);
  assert.equal(dueReminder(request, day(19)), null);
  const first = dueReminder(request, day(20))!;
  assert.equal(first.reminder, 1);
  request = { ...request, ...first.update };
  assert.equal(request.nextReminderAt, '2027-02-10T10:00:00.000Z');
  const second = dueReminder(request, day(41))!;
  assert.equal(second.reminder, 2);
  request = { ...request, ...second.update };
  assert.equal(request.nextReminderAt, null);
  assert.equal(dueReminder(request, day(59)), null);
  assert.equal(dueReminder({ ...newTaxRequest('o', at), status: 'DONE' }, day(30)), null, 'plus de relance une fois rempli');
});

test('payouts continue during the 60 days and stop only afterwards if details are missing', () => {
  const request = newTaxRequest('o', at);
  assert.equal(taxHoldsPayouts(undefined, false, day(100)), false, 'aucune demande : rien n’est bloqué');
  assert.equal(taxHoldsPayouts(request, false, day(59)), false);
  assert.equal(taxHoldsPayouts(request, false, day(60)), true);
  assert.equal(taxHoldsPayouts(request, true, day(90)), false);
});
