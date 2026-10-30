import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECKIN_VERSION, CHECKIN_AREAS, CHECKIN_QUESTIONS, emptyCheckinAssessments, type CheckinField } from './checkinAssessment';
import { compactCheckinComments } from './inventoryPayload';
import { inventoryDocumentHtml } from './inventoryDocument';
const photo = 'data:image/jpeg;base64,YWJj';
function completed() {
  const assessments = emptyCheckinAssessments();
  for (const area of CHECKIN_AREAS) for (const key of Object.keys(CHECKIN_QUESTIONS[area])) assessments[area][key as CheckinField] = true;
  return { checkinVersion: CHECKIN_VERSION, assessments };
}
test('extended arrival requires explicit answers to equipment, furniture, access and key checks', () => {
  const data = completed();
  assert.equal(JSON.parse(compactCheckinComments(JSON.stringify(data))).nonConformities.length, 0);
  for (const [area, key] of [['ROOM', 'equipmentOk'], ['COMMONS', 'furnitureOk'], ['ARRIVAL', 'accessInstructionsOk'], ['ARRIVAL', 'keysOk']] as const) {
    const missing = completed(); missing.assessments[area][key] = null;
    assert.throws(() => compactCheckinComments(JSON.stringify(missing)), /tous les contrôles/);
  }
});
test('equipment and furniture issues are retained with evidence in the report and document', () => {
  const data = completed(); data.assessments.ROOM.equipmentOk = false; data.assessments.ROOM.furnitureOk = false;
  assert.throws(() => compactCheckinComments(JSON.stringify(data)), /Décrivez/);
  data.assessments.ROOM.comment = 'Bureau abîmé et lampe inutilisable'; data.assessments.ROOM.photos = [photo];
  const comments = compactCheckinComments(JSON.stringify(data));
  const saved = JSON.parse(comments);
  assert.equal(saved.nonConformities[0].equipmentOk, false);
  assert.equal(saved.nonConformities[0].furnitureOk, false);
  const html = inventoryDocumentHtml({ bookingId: 'booking', type: 'IN', comments, date: '2026-10-26T13:00:00Z' } as any, 'Entrée');
  assert.match(html, /Équipements présents et fonctionnels/);
  assert.match(html, /Mobilier présent et en bon état/);
  assert.match(html, /Non-conformités signalées/);
  assert.match(html, /Bureau abîmé/);
});
test('access problems need a comment but no artificial photo requirement', () => {
  const data = completed(); data.assessments.ARRIVAL.keysOk = false;
  assert.throws(() => compactCheckinComments(JSON.stringify(data)), /Décrivez/);
  data.assessments.ARRIVAL.comment = 'La serrure était difficile à ouvrir';
  const comments = compactCheckinComments(JSON.stringify(data));
  assert.equal(JSON.parse(comments).nonConformities[0].area, 'ARRIVAL');
  const html = inventoryDocumentHtml({ bookingId: 'booking', type: 'IN', comments, date: '2026-10-26T13:00:00Z' } as any, 'Entrée');
  assert.match(html, /Arrivée et remise des clés/);
  assert.match(html, /La serrure était difficile/);
});
test('all optional arrival photos fit alongside the ten allowed room/common photos', () => {
  const data = completed(); const largePhoto = `data:image/jpeg;base64,${Buffer.alloc(45 * 1024, 65).toString('base64')}`;
  data.assessments.ROOM.photos = Array(5).fill(largePhoto); data.assessments.COMMONS.photos = Array(5).fill(largePhoto); data.assessments.ARRIVAL.photos = Array(2).fill(largePhoto);
  const comments = compactCheckinComments(JSON.stringify(data));
  assert.ok(Buffer.byteLength(comments) < 780 * 1024);
  assert.ok(Buffer.byteLength(JSON.stringify({ report: { comments } })) < 900 * 1024);
});
