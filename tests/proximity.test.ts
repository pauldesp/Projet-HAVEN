import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, sortByDistance, nearbyListings } from '../services/proximity';
test('sorts nearby homes by ascending distance from La Rochelle', () => {
  const origin = { lat: 46.16, lng: -1.15 };
  const listings = [
    { id: 'Paris', coordinates: { lat: 48.8566, lng: 2.3522 } },
    { id: 'Niort', coordinates: { lat: 46.323, lng: -0.464 } },
    { id: 'Nantes', coordinates: { lat: 47.218, lng: -1.553 } },
  ];
  assert.deepEqual(sortByDistance(listings, origin).map(x => x.id), ['Niort', 'Nantes', 'Paris']);
  assert.equal(listings[0].id, 'Paris');
  assert.equal(distanceKm(origin, origin), 0);
  assert.ok(distanceKm(origin, listings[1].coordinates) > 50);
});
test('excludes invalid positions rather than placing them first', () => {
  assert.equal(sortByDistance([{ coordinates: { lat: NaN, lng: 0 } }, { coordinates: undefined as any }], { lat: 46, lng: -1 }).length, 0);
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
