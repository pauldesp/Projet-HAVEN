export type Coordinates = { lat: number; lng: number };
export function validCoordinates(value: Coordinates | undefined | null): value is Coordinates {
  return !!value && Number.isFinite(value.lat) && Number.isFinite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180;
}
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const h = Math.sin(radians(b.lat - a.lat) / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function sortByDistance<T extends { coordinates: Coordinates }>(items: T[], origin: Coordinates): (T & { distance: number })[] {
  return items.filter(item => validCoordinates(item.coordinates))
    .map(item => ({ ...item, distance: distanceKm(origin, item.coordinates) }))
    .sort((a, b) => a.distance - b.distance);
}
export async function resolveCityCoordinates(city: string, code: string, signal: AbortSignal): Promise<Coordinates> {
  const params = new URLSearchParams({ fields: 'nom,centre', limit: '5', boost: 'population' });
  params.set(code ? 'code' : 'nom', code || city.split(',')[0].trim());
  const response = await fetch(`https://geo.api.gouv.fr/communes?${params}`, { signal });
  if (!response.ok) throw new Error('Localisation indisponible');
  const communes = await response.json();
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const match = code ? communes[0] : communes.find((item: { nom: string }) => normalize(item.nom) === normalize(city.split(',')[0]));
  const [lng, lat] = match?.centre?.coordinates || [];
  const result = { lat, lng };
  if (!validCoordinates(result)) throw new Error('Ville introuvable');
  return result;
}
