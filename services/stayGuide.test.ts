import test from 'node:test';
import assert from 'node:assert/strict';
import { formatStayGuide, normalizePracticalInfo, releasedStayGuide } from './stayGuide';
import { instructionsDueAt, createReservationConfirmation } from './reservationFulfillment';
import { reservationLifecycleEmail } from './reservationMail';
import { reservationResendTemplate } from './resendTemplates';
import type { Booking } from '../types';

const booking = { id: 'booking', listingId: 'listing', roomId: 'room', ownerId: 'owner', tenantId: 'tenant', status: 'CONFIRMED', paymentStatus: 'PAID', startDate: '2026-11-07', endDate: '2026-11-14', checkInTime: '15:00', paidAt: '2026-10-26T09:00:00Z', paymentProvider: 'SIMULATION', basePrice: 80, cleaningFee: 5, platformFee: 15, totalPrice: 100 } as Booking;
const access = { instructions: 'Boîte à clés 1234', practicalInfo: { parking: 'Place 8', wifiName: 'Haven & maison', wifiPassword: 'Secret<123>', equipment: 'Thermostat dans le salon', waste: 'Bacs verts', usefulInfo: 'Bus 4' } };

test('access codes, Wi-Fi and useful details are all hidden until exactly 72 hours before check-in', () => {
  const due = instructionsDueAt(booking);
  const before = releasedStayGuide(booking, due, access, Date.parse(due) - 1);
  assert.deepEqual(before, { arrivalInformationAvailable: false, instructions: '' });
  assert.equal(JSON.stringify(before).includes('Secret'), false);
  assert.equal(Object.hasOwn(before, 'practicalInfo'), false);
  const released = releasedStayGuide(booking, due, access, Date.parse(due));
  assert.equal(released.arrivalInformationAvailable, true);
  assert.equal(released.practicalInfo?.wifiPassword, access.practicalInfo.wifiPassword);
  assert.equal(released.practicalInfo?.parking, 'Place 8');
});
test('last-minute bookings release on payment while unpaid or cancelled stays never release practical details', () => {
  const late = { ...booking, paidAt: '2026-11-06T12:00:00Z' };
  const due = instructionsDueAt(late);
  assert.equal(due, '2026-11-06T12:00:00.000Z');
  assert.equal(releasedStayGuide(late, due, access, Date.parse(due)).arrivalInformationAvailable, true);
  assert.equal(releasedStayGuide({ ...late, paymentStatus: 'PENDING' }, due, access, Date.parse(due)).arrivalInformationAvailable, false);
  assert.equal(releasedStayGuide({ ...late, status: 'CANCELLED' }, due, access, Date.parse(due)).arrivalInformationAvailable, false);
});
test('legacy instructions still work; optional practical fields have bounded validated values', () => {
  assert.equal(formatStayGuide({ instructions: 'Anciennes consignes' }), 'Anciennes consignes');
  assert.equal(formatStayGuide(undefined), '');
  assert.equal(normalizePracticalInfo({ parking: ' Place 2 ' }).parking, 'Place 2');
  assert.throws(() => normalizePracticalInfo({ wifiPassword: 'x'.repeat(201) }));
  assert.throws(() => normalizePracticalInfo({ parking: { invalid: true } }));
  assert.throws(() => normalizePracticalInfo([]));
  assert.equal(normalizePracticalInfo({ wifiPassword: ' secret with spaces ' }).wifiPassword, ' secret with spaces ');
});
test('the arrival email includes all practical details through the existing Resend template and safely escapes them', () => {
  const receipt = createReservationConfirmation(booking, { title: 'Maison' }, { email: 'tenant@example.test' });
  const instructions = formatStayGuide(access);
  for (const value of Object.values(access.practicalInfo)) assert.ok(instructions.includes(value));
  const mail = reservationLifecycleEmail('ARRIVAL', receipt, { instructions });
  assert.ok(mail.text.includes('Secret<123>'));
  assert.ok(mail.html.includes('Secret&lt;123&gt;'));
  const arrival = reservationResendTemplate('ARRIVAL', receipt, { instructions, appOrigin: 'https://haven.example' });
  assert.ok(arrival.template.variables.CONSIGNES_ACCES.includes('Secret&lt;123&gt;'));
  assert.equal(JSON.stringify(reservationResendTemplate('CONFIRMATION', receipt, { appOrigin: 'https://haven.example' })).includes('Secret'), false);
});
