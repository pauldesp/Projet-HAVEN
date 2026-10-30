import test from 'node:test';
import assert from 'node:assert/strict';
import { CLEANING_POLICY_VERSION, CHECKOUT_TASK_LABELS, assertCleaningPolicyAccepted, assertDetailedCheckout } from './cleaningPolicy';
import { prepareInventoryReport } from './bookingLifecycle';
import type { Booking, Listing, InventoryReport } from '../types';
const photo = 'data:image/jpeg;base64,QUJD';
const details = () => ({ cleaningPolicyVersion: CLEANING_POLICY_VERSION, checklist: { ...Object.fromEntries(Object.keys(CHECKOUT_TASK_LABELS).map(key => [key, true])), damage_reported: false }, photos: { ROOM: [photo, photo], KITCHEN: [photo], COMMONS: [photo], BATHROOM: [photo], KEYS: [photo], DAMAGE: [] } });
test('cleaning rules require the current explicit acknowledgment', () => {
  assert.throws(() => assertCleaningPolicyAccepted(undefined)); assert.throws(() => assertCleaningPolicyAccepted('old-version'));
  assert.doesNotThrow(() => assertCleaningPolicyAccepted(CLEANING_POLICY_VERSION));
});
test('detailed checkout requires every concrete task and bathroom evidence', () => {
  assert.doesNotThrow(() => assertDetailedCheckout(details()));
  for (const key of Object.keys(CHECKOUT_TASK_LABELS)) {
    const data = details(); data.checklist[key] = false;
    assert.throws(() => assertDetailedCheckout(data), key);
  }
  const noBathroom = details(); noBathroom.photos.BATHROOM = [];
  assert.throws(() => assertDetailedCheckout(noBathroom), /photos/);
  const damage = details(); damage.checklist.damage_reported = true;
  assert.throws(() => assertDetailedCheckout(damage), /dégradation/);
});
test('new bookings cannot bypass detailed exit checks; archived legacy reports remain usable', () => {
  const booking = { id: 'b', tenantId: 't', ownerId: 'o', status: 'CONFIRMED', paymentStatus: 'PAID', checkInReportId: 'in', startDate: '2026-11-01', endDate: '2026-11-07', checkOutTime: '11:00', cleaningPolicyVersion: CLEANING_POLICY_VERSION } as Booking;
  const report = { id: 'out', bookingId: 'b', tenantId: 't', ownerId: 'o', type: 'OUT', status: 'COMPLETED', identityValidated: true, signature: 'USER_SIGNED', items: [], comments: '{}' } as unknown as InventoryReport;
  const now = new Date('2026-11-07T10:00:00Z');
  assert.throws(() => prepareInventoryReport(booking, {} as Listing, 't', report, now), /contrôles/);
  assert.doesNotThrow(() => prepareInventoryReport(booking, {} as Listing, 't', { ...report, comments: JSON.stringify(details()) }, now));
  assert.doesNotThrow(() => prepareInventoryReport({ ...booking, cleaningPolicyVersion: undefined }, {} as Listing, 't', report, now));
});
