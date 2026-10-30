import test from 'node:test';
import assert from 'node:assert/strict';
import type { Booking, InventoryReport } from '../types';
import { connectStatus, DEPOSIT_POLICY, hasRecordedArrival, ownerShareCents, payoutStatus } from './stripeConnect';

test('owner receives the stay and cleaning in full; Haven bears provider costs', () => {
  assert.equal(ownerShareCents({ basePrice: 110, cleaningFee: 15, platformFee: 17, totalPrice: 142 }), 12500);
  assert.equal(ownerShareCents({ basePrice: 110.25, cleaningFee: 15.55, platformFee: 17, totalPrice: 142.8 }), 12580);
  for (const totalPrice of [141, NaN, Infinity, -1]) assert.throws(() => ownerShareCents({ basePrice: 110, cleaningFee: 15, platformFee: 17, totalPrice }));
});
test('arrival requires a paid Stripe booking, matching entry inventory and private server proof', () => {
  const booking = { id: 'b', tenantId: 't', paymentProvider: 'STRIPE', paymentStatus: 'PAID', status: 'CONFIRMED', checkInReportId: 'in' } as Booking;
  const report = { id: 'in', bookingId: 'b', tenantId: 't', type: 'IN' } as InventoryReport;
  const proof = { reportId: 'in', tenantId: 't' };
  assert.equal(hasRecordedArrival(booking, report, proof), true);
  assert.equal(hasRecordedArrival(booking, report, null), false);
  assert.equal(hasRecordedArrival(booking, null, proof), false);
  assert.equal(hasRecordedArrival(booking, { ...report, type: 'OUT' }, proof), false);
  assert.equal(hasRecordedArrival(booking, { ...report, tenantId: 'other' }, proof), false);
  for (const change of [{ status: 'CANCELLED' }, { paymentStatus: 'PENDING' }, { paymentProvider: 'SIMULATION' }, { checkInReportId: undefined }]) assert.equal(hasRecordedArrival({ ...booking, ...change } as Booking, report, proof), false);
});
test('account return URL alone does not prove payouts ready', () => {
  assert.equal(connectStatus({ details_submitted: true, payouts_enabled: false }), 'PENDING');
  assert.equal(connectStatus({ payouts_enabled: true, capabilities: { transfers: 'pending' } }), 'INCOMPLETE');
  assert.equal(connectStatus({ payouts_enabled: true, capabilities: { transfers: 'active' }, requirements: { currently_due: ['external_account'] } }), 'INCOMPLETE');
  assert.equal(connectStatus({ payouts_enabled: true, capabilities: { transfers: 'active' } }), 'READY');
  assert.equal(connectStatus({ requirements: { disabled_reason: 'rejected.fraud' } }), 'RESTRICTED');
});
test('bank payouts reflect Stripe statuses including failure after paid', () => {
  assert.deepEqual(['pending', 'in_transit', 'paid', 'failed', 'canceled'].map(payoutStatus), ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED']);
  assert.throws(() => payoutStatus('transfer_created'));
});
test('deposit has no arbitrary amount and cannot be enabled accidentally', () => {
  assert.equal(DEPOSIT_POLICY.enabled, false);
  assert.equal(DEPOSIT_POLICY.amountCents, null);
  assert.equal(DEPOSIT_POLICY.timing, 'TO_DEFINE');
});
