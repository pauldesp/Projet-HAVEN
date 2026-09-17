import test from 'node:test';
import assert from 'node:assert/strict';
import { City, exactCity, findCities, normalizeCity } from './cities';
import { distanceKm, nearbyListings } from './proximity';
const cities: City[] = [
  {nom: 'Niort', code: '79191', codesPostaux: ['79000']},
  {nom: 'La Rochelle', code: '17300', codesPostaux: ['17000']},
  {nom: 'Saint-Étienne', code: '42218', codesPostaux: ['42000']},
  {nom: 'Saint-Aubin', code: '1', codesPostaux: ['10000']},
  {nom: 'Saint-Aubin', code: '2', codesPostaux: ['20000']},
];
test('typos suggest corrections without silently resolving', () => {
  assert.equal(findCities(cities, 'Nirot')[0]?.nom, 'Niort');
  assert.equal(findCities(cities, 'Nior')[0]?.nom, 'Niort');
  assert.equal(exactCity(cities, 'Nirot'), null);
});
test('accents, prefixes, postal codes and unknown names', () => {
  assert.equal(normalizeCity(' Saint-Étienne '), 'saintetienne');
  assert.equal(exactCity(cities, 'saint etienne')?.code, '42218');
  assert.equal(findCities(cities, 'La Roch')[0]?.nom, 'La Rochelle');
  assert.equal(findCities(cities, '79000')[0]?.nom, 'Niort');
  assert.deepEqual(findCities(cities, 'zzzzzzzz'), []);
});
test('namesakes require a postal-code choice', () => {
  assert.equal(exactCity(cities, 'Saint-Aubin'), null);
  assert.equal(exactCity(cities, 'Saint-Aubin, 20000')?.code, '2');
});
test('nearby results exclude unavailable, exact, invalid and distant listings, and sort by distance', () => {
  const origin = {lat: 46.323, lng: -0.46};
  const listings = [
    {id: 'near', availableRooms: 1, coordinates: {lat: 46.36, lng: -0.39}},
    {id: 'closer', availableRooms: 1, coordinates: {lat: 46.33, lng: -0.46}},
    {id: 'far', availableRooms: 1, coordinates: {lat: 48.85, lng: 2.35}},
    {id: 'exact', availableRooms: 1, coordinates: origin},
    {id: 'full', availableRooms: 0, coordinates: origin},
    {id: 'invalid', availableRooms: 1, coordinates: {lat: NaN, lng: 0}},
  ];
  assert.deepEqual(nearbyListings(listings, origin, new Set(['exact'])).map(item => item.id), ['closer', 'near']);
  assert.equal(distanceKm(origin, origin), 0);
  assert.deepEqual(nearbyListings(listings.slice(2), origin, new Set(['exact'])), []);
});
