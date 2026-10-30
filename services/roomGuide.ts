export interface RoomGuide {
  location: string;
  keyLabel: string;
  doorPhoto: string;
  interiorPhoto: string;
}
export function normalizeRoomGuide(value: unknown): RoomGuide {
  if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) throw new Error('Repères de chambre invalides.');
  const data = (value || {}) as Record<string, unknown>;
  const result: RoomGuide = { location: '', keyLabel: '', doorPhoto: '', interiorPhoto: '' };
  for (const field of ['location', 'keyLabel', 'doorPhoto', 'interiorPhoto'] as const) {
    const text = data[field] ?? '';
    const photo = field === 'doorPhoto' || field === 'interiorPhoto';
    if (typeof text !== 'string' || text.length > (photo ? 65000 : field === 'location' ? 1000 : 300)) throw new Error('Repères de chambre trop longs ou photo trop volumineuse.');
    if (photo && text && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(text)) throw new Error('Photo de chambre invalide.');
    result[field] = text.trim();
  }
  return result;
}
export function normalizeRoomGuides(value: unknown, roomIds: string[]): Record<string, RoomGuide> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 50) throw new Error('Repères de chambres invalides.');
  return Object.fromEntries(Object.entries(value).map(([id, guide]) => {
    if (!roomIds.includes(id) || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new Error('Cette chambre ne fait pas partie du logement.');
    return [id, normalizeRoomGuide(guide)];
  }));
}
export function formatRoomGuide(guide?: RoomGuide) {
  if (!guide || !Object.values(guide).some(Boolean)) return '';
  return ['Reconnaître votre chambre', guide.location, guide.keyLabel ? `Repère de la clé : ${guide.keyLabel}` : '',
    guide.doorPhoto || guide.interiorPhoto ? 'Retrouvez les photos de votre porte et de votre chambre dans les informations de votre réservation sur Haven.' : ''].filter(Boolean).join('\n');
}
