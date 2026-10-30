import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../contexts/LanguageContext';
import { RoomArrivalGuide } from '../components/RoomArrivalGuide';
import { normalizeRoomGuide, normalizeRoomGuides, formatRoomGuide } from './roomGuide';
import { releasedStayGuide, formatStayGuide } from './stayGuide';
const photo = 'data:image/jpeg;base64,YWJj';
const guide = normalizeRoomGuide({ location: 'Étage 1, porte Émeraude / 2', keyLabel: 'Clé 2', doorPhoto: photo, interiorPhoto: photo });
test('private room guide validates images, sizes and ownership of room identifiers', () => {
  assert.equal(normalizeRoomGuide(undefined).location, '');
  assert.equal(normalizeRoomGuides({ emerald: guide }, ['emerald']).emerald.keyLabel, 'Clé 2');
  assert.throws(() => normalizeRoomGuides({ other: guide }, ['emerald']));
  assert.throws(() => normalizeRoomGuide({ doorPhoto: 'https://outside.example/secret.jpg' }));
  assert.throws(() => normalizeRoomGuide({ interiorPhoto: 'data:image/svg+xml;base64,YWJj' }));
  assert.throws(() => normalizeRoomGuide({ location: 'a'.repeat(1001) }));
  assert.throws(() => normalizeRoomGuide({ doorPhoto: photo + 'a'.repeat(65000) }));
});
test('arrival release gate withholds room identification and photos before payment and before 72h', () => {
  const booking = { status: 'CONFIRMED' as const, paymentStatus: 'PAID' as const };
  const due = '2026-11-04T14:00:00Z', now = Date.parse(due);
  assert.equal(Object.hasOwn(releasedStayGuide(booking, due, undefined, now - 1, guide), 'roomGuide'), false);
  assert.equal(Object.hasOwn(releasedStayGuide({ ...booking, paymentStatus: 'PENDING' }, due, undefined, now, guide), 'roomGuide'), false);
  assert.equal(Object.hasOwn(releasedStayGuide({ ...booking, status: 'CANCELLED' }, due, undefined, now, guide), 'roomGuide'), false);
  assert.deepEqual(releasedStayGuide(booking, due, undefined, now, guide).roomGuide, guide);
  const markup = renderToStaticMarkup(React.createElement(LanguageProvider, null, React.createElement(RoomArrivalGuide, { available: false, guide, roomName: 'Émeraude' })));
  assert.equal(markup, '');
});
test('arrival email includes room directions but keeps private images out of the email payload', () => {
  assert.match(formatRoomGuide(guide), /Étage 1/);
  assert.match(formatStayGuide({ instructions: 'Accès général' }, guide), /Clé 2/);
  assert.doesNotMatch(formatRoomGuide(guide), /data:image/);
  const markup = renderToStaticMarkup(React.createElement(LanguageProvider, null, React.createElement(RoomArrivalGuide, { available: true, guide, roomName: 'Émeraude' })));
  assert.match(markup, /Étage 1/);
  assert.equal((markup.match(/<img /g) || []).length, 2);
});
