import test from 'node:test';
import assert from 'node:assert/strict';
import { compactCheckinComments, MAX_CHECKIN_PHOTOS_PER_AREA } from './inventoryPayload';
import { prepareInventoryReport } from './bookingLifecycle';
import { inventoryDocumentHtml } from './inventoryDocument';

const photo = `data:image/jpeg;base64,${Buffer.alloc(45 * 1024, 65).toString('base64')}`;
const assessment = { clean: false, tidy: true, conditionOk: true, comment: 'Trace constatée à l’arrivée.', photos: Array.from({ length: MAX_CHECKIN_PHOTOS_PER_AREA }, () => photo) };
const comments = () => JSON.stringify({ assessments: { ROOM: assessment, COMMONS: assessment }, nonConformities: [{ area: 'ROOM', ...assessment }, { area: 'COMMONS', ...assessment }] });
test('five photos per space are retained once and fit HTTP and Firestore report limits', () => {
  const packed = compactCheckinComments(comments());
  const details = JSON.parse(packed);
  assert.equal(details.assessments.ROOM.photos.length, 5);
  assert.equal(details.assessments.COMMONS.photos.length, 5);
  assert.equal(details.nonConformities.length, 2);
  assert.equal('photos' in details.nonConformities[0], false);
  assert.ok(Buffer.byteLength(packed) < 780 * 1024);
  assert.ok(Buffer.byteLength(JSON.stringify({ report: { comments: packed } })) < 900 * 1024);
});
test('a sixth photo is rejected and the original saved findings remain unchanged', () => {
  const excessive = { ...assessment, photos: [...assessment.photos, photo] };
  assert.throws(() => compactCheckinComments(JSON.stringify({ assessments: { ROOM: excessive } })), /Cinq photos/);
  assert.equal(assessment.photos.length, 5);
});
test('server normalizes legacy duplicated images and the document retains all ten photos', () => {
  const booking = { id: 'booking', tenantId: 'tenant', ownerId: 'owner', startDate: '2026-10-19', endDate: '2026-10-28', status: 'CONFIRMED', paymentStatus: 'PAID' } as any;
  const report = prepareInventoryReport(booking, {} as any, 'tenant', { id: 'inv_test', bookingId: 'booking', tenantId: 'tenant', ownerId: 'owner', type: 'IN', identityValidated: true, status: 'COMPLETED', signature: 'USER_SIGNED', items: [], comments: comments() } as any, new Date('2026-10-19T20:00:00Z'));
  assert.equal(JSON.parse(report.comments).nonConformities[0].photos, undefined);
  const html = inventoryDocumentHtml(report, 'État des lieux d’entrée');
  assert.equal((html.match(/alt="Photo /g) || []).length, 10);
  assert.match(html, /Non-conformités signalées/);
  assert.match(html, /object-fit:contain/);
});
