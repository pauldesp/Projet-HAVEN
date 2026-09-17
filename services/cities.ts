export interface City {
  nom: string;
  code: string;
  codesPostaux: string[];
  centre?: { coordinates: [number, number] };
  population?: number;
}

export const normalizeCity = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const cityLabel = (city: City) => `${city.nom}, ${city.codesPostaux[0] || city.code}`;

// Shared, lazy catalogue: search stays local after the first download, including typos.
let catalogue: Promise<City[]> | undefined;
export function loadCities(): Promise<City[]> {
  if (!catalogue) {
    catalogue = fetch('https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,centre,population', { signal: AbortSignal.timeout(15000) })
      .then(async response => {
        if (!response.ok) throw new Error('Communes indisponibles');
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Réponse invalide');
        return data as City[];
      }).catch(error => { catalogue = undefined; throw error; });
  }
  return catalogue;
}

// Damerau-Levenshtein also handles swapped letters (Nirot → Niort).
export function cityDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  rows[0] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
  }
  return rows[a.length][b.length];
}

export function findCities(cities: City[], value: string): City[] {
  const query = normalizeCity(value.split(',')[0]);
  if (query.length < 2) return [];
  const postal = value.match(/\b\d{5}\b/)?.[0];
  return cities.map(city => {
    const name = normalizeCity(city.nom);
    let score = name === query ? 0 : name.startsWith(query) ? 1 : Infinity;
    if (postal && city.codesPostaux.includes(postal)) score = Math.min(score, name === query ? 0 : 1);
    if (score === Infinity && query.length >= 4 && Math.abs(name.length - query.length) <= 2) {
      const distance = cityDistance(name, query);
      if (distance <= (query.length > 7 ? 2 : 1)) score = distance + 2;
    }
    return { city, score };
  }).filter(item => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score || (b.city.population || 0) - (a.city.population || 0))
    .slice(0, 6).map(item => item.city);
}

export function exactCity(cities: City[], value: string): City | null {
  const name = normalizeCity(value.split(',')[0]);
  const postal = value.match(/\b\d{5}\b/)?.[0];
  const matches = cities.filter(city => normalizeCity(city.nom) === name && (!postal || city.codesPostaux.includes(postal)));
  return matches.length === 1 ? matches[0] : null;
}
