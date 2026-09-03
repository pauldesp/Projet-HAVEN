export function distanceKm(a: {lat: number; lng: number}, b: {lat: number; lng: number}): number {
  if (![a.lat, a.lng, b?.lat, b?.lng].every(Number.isFinite) || Math.abs(a.lat) > 90 || Math.abs(b.lat) > 90 || Math.abs(a.lng) > 180 || Math.abs(b.lng) > 180) return Infinity;
  const rad = (degrees: number) => degrees * Math.PI / 180;
  const d = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(d), Math.sqrt(Math.max(0, 1 - d)));
}

export function nearbyListings<T extends {id: string; availableRooms: number; coordinates: {lat: number; lng: number}}>(listings: T[], origin: {lat: number; lng: number}, exactIds: Set<string>, radius = 50): (T & {distance: number})[] {
  return listings.filter(listing => listing.availableRooms > 0 && !exactIds.has(listing.id))
    .map(listing => ({...listing, distance: distanceKm(origin, listing.coordinates)}))
    .filter(listing => listing.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
}
