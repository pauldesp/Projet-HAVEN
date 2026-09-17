import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, sortByDistance } from '../services/proximity';
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
