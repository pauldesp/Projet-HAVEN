import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHousematePreviews, eligibleHousemateBookings, HousemateBooking, HousemateProfile } from './housemates';

const stay = { viewerId: 'visitor', roomId: 'room-a', startDate: '2026-10-24', endDate: '2026-10-31' };
const confirmed = (tenantId: string, startDate = '2026-10-20', endDate = '2026-11-05'): HousemateBooking => ({
  tenantId, roomId: 'room-b', status: 'CONFIRMED', startDate, endDate,
});
const visible = (id: string): HousemateProfile => ({
  id, firstName: 'Camille', avatarUrl: 'https://example.test/avatar.jpg',
  birthDate: '2000-10-15', job: 'Architecte', shareProfileWithHousemates: true,
});

test('seules les réservations confirmées dans une autre chambre et avec une nuit commune sont éligibles', () => {
  const eligible = confirmed('eligible');
  const bookings = [
    eligible,
    confirmed('leaving-on-arrival', '2026-10-20', stay.startDate),
    confirmed('arriving-on-departure', stay.endDate, '2026-11-05'),
    { ...confirmed('pending'), status: 'PENDING' },
    { ...confirmed('same-room'), roomId: stay.roomId },
    confirmed(stay.viewerId),
  ];
  assert.deepEqual(eligibleHousemateBookings(bookings, stay), [eligible]);
});

test('le consentement est nécessaire et la réponse ne contient aucune donnée privée', () => {
  const profiles = new Map<string, HousemateProfile>([
    ['visible', { ...visible('visible'), email: 'private@example.test', phone: '+33600000000' } as HousemateProfile],
    ['hidden', { ...visible('hidden'), shareProfileWithHousemates: false }],
  ]);
  const result = buildHousematePreviews(
    [confirmed('visible'), confirmed('hidden'), confirmed('missing')], profiles, stay,
    new Date('2026-10-13T12:00:00'),
  );
  assert.deepEqual(result, [{
    id: 'visible', firstName: 'Camille', avatarUrl: 'https://example.test/avatar.jpg',
    age: 25, activity: 'Architecte', coverage: 'FULL',
  }]);
  assert.equal(JSON.stringify(result).includes('private@example.test'), false);
  assert.equal(JSON.stringify(result).includes('2026-10-20'), false);
});

test('une personne n’apparaît qu’une fois même avec plusieurs réservations', () => {
  const profiles = new Map<string, HousemateProfile>([['camille', visible('camille')]]);
  const result = buildHousematePreviews([
    confirmed('camille', '2026-10-24', '2026-10-26'),
    confirmed('camille', '2026-10-27', '2026-10-31'),
  ], profiles, stay);
  assert.equal(result.length, 1);
  assert.equal(result[0].coverage, 'PARTIAL');
});

test('l’âge n’est pas présenté pour une date de naissance invalide', () => {
  const profiles = new Map<string, HousemateProfile>([['camille', { ...visible('camille'), birthDate: '2000-02-30' }]]);
  assert.equal(buildHousematePreviews([confirmed('camille')], profiles, stay)[0].age, undefined);
});
