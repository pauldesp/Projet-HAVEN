import test from 'node:test';
import assert from 'node:assert/strict';
import type { Booking, InventoryReport } from '../types';
import { submitInventoryReport } from './inventorySubmission';
import { prepareInventoryReport, recoverInventoryReport } from './bookingLifecycle';

const booking = { id: 'booking', tenantId: 'tenant', ownerId: 'owner', listingId: 'listing', startDate: '2026-10-19', endDate: '2026-10-28', status: 'CONFIRMED', paymentStatus: 'PAID', timeZone: 'Europe/Paris' } as Booking;
const report = { id: 'inv_in_booking', bookingId: 'booking', tenantId: 'tenant', ownerId: 'owner', type: 'IN', date: '', identityValidated: true, items: [], comments: '{"assessments":{"ROOM":{"clean":true,"tidy":true,"conditionOk":true,"photos":[]},"COMMONS":{"clean":true,"tidy":true,"conditionOk":true,"photos":[]}},"nonConformities":[]}', status: 'COMPLETED', signature: 'USER_SIGNED' } as InventoryReport;
const noWait = async () => {};

test('entry with no defects completes once even when its first response is lost', async () => {
  let writes = 0, attempts = 0;
  let saved: InventoryReport;
  const result = await submitInventoryReport(report, async (_url, init) => {
    const input = JSON.parse(String(init.body)).report;
    attempts++;
    if (!saved) {
      saved = prepareInventoryReport(booking, {} as any, 'tenant', input, new Date('2026-10-19T20:00:00Z'));
      booking.checkInReportId = saved.id;
      writes++; // The transaction also creates its single linked document.
      throw new TypeError('Load failed');
    }
    return Response.json({ report: recoverInventoryReport(booking, 'tenant', input, saved) });
  }, noWait);
  assert.equal(attempts, 2);
  assert.equal(writes, 1);
  assert.equal(result.id, report.id);
  assert.equal(result.date, '2026-10-19T20:00:00.000Z');
});
test('an intermittent server failure retries the same report and then confirms', async () => {
  let calls = 0;
  const result = await submitInventoryReport(report, async () => ++calls === 1 ? Response.json({ error: 'Indisponible' }, { status: 503 }) : Response.json({ report }), noWait);
  assert.equal(result.id, report.id);
  assert.equal(calls, 2);
});
test('business errors are shown without retrying or claiming success', async () => {
  let calls = 0;
  await assert.rejects(submitInventoryReport(report, async () => { calls++; return Response.json({ error: 'La date est dépassée.' }, { status: 409 }); }, noWait), /date est dépassée/);
  assert.equal(calls, 1);
});
test('a persistent Safari connection failure gives a useful message without losing the input', async () => {
  const original = structuredClone(report);
  await assert.rejects(submitInventoryReport(report, async () => { throw new TypeError('Load failed'); }, noWait), /réponses sont conservées/);
  assert.deepEqual(report, original);
});
test('recovering a report remains private and does not allow changing the saved result', () => {
  const saved = { ...report, date: '2026-10-19T20:00:00Z' };
  const linked = { ...booking, checkInReportId: report.id };
  assert.equal(recoverInventoryReport(linked, 'tenant', { ...report, comments: 'replacement' }, saved).comments, report.comments);
  assert.throws(() => recoverInventoryReport(linked, 'other', report, saved), /locataire/);
  assert.throws(() => recoverInventoryReport(linked, 'tenant', { ...report, bookingId: 'another' }, saved), /correspond/);
});
