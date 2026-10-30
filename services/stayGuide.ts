import { formatRoomGuide, type RoomGuide } from './roomGuide';
import { canReleaseArrivalInstructions } from './reservationFulfillment';
import type { Booking } from '../types';

export const PRACTICAL_INFO_FIELDS = [
  { key: 'parking', label: 'Stationnement', limit: 2000 },
  { key: 'wifiName', label: 'Nom du réseau Wi-Fi', limit: 100 },
  { key: 'wifiPassword', label: 'Mot de passe Wi-Fi', limit: 200 },
  { key: 'equipment', label: 'Équipements et fonctionnement', limit: 2000 },
  { key: 'weeklyCleaning', label: 'Organisation du ménage hebdomadaire', limit: 2000 },
  { key: 'waste', label: 'Tri et poubelles', limit: 2000 },
  { key: 'usefulInfo', label: 'Autres informations utiles', limit: 2000 },
] as const;
export type StayPracticalInfo = Record<typeof PRACTICAL_INFO_FIELDS[number]['key'], string>;
export function normalizePracticalInfo(value: unknown): StayPracticalInfo {
  if (value !== undefined && (value === null || typeof value !== 'object' || Array.isArray(value))) throw new Error('Informations pratiques invalides.');
  const data = (value || {}) as Record<string, unknown>;
  return Object.fromEntries(PRACTICAL_INFO_FIELDS.map(({ key, label, limit }) => {
    const text = data[key] ?? '';
    if (typeof text !== 'string' || text.length > limit) throw new Error(`${label} : ${limit} caractères maximum.`);
    return [key, key === 'wifiPassword' || key === 'wifiName' ? text : text.trim()];
  })) as StayPracticalInfo;
}
export function formatStayGuide(access: { instructions?: unknown; practicalInfo?: unknown } | undefined, roomGuide?: RoomGuide): string {
  const instructions = typeof access?.instructions === 'string' ? access.instructions.trim() : '';
  const practical = normalizePracticalInfo(access?.practicalInfo);
  return [instructions, formatRoomGuide(roomGuide), ...PRACTICAL_INFO_FIELDS.filter(({ key }) => practical[key]).map(({ key, label }) => `${label}\n${practical[key]}`)].filter(Boolean).join('\n\n');
}
/** The same server-controlled release gate covers codes, Wi-Fi and all practical details. */
export function releasedStayGuide(booking: Pick<Booking, 'status' | 'paymentStatus'>, dueAt: string, access?: { instructions?: unknown; practicalInfo?: unknown }, now = Date.now(), roomGuide?: RoomGuide): { arrivalInformationAvailable: boolean; instructions: string; practicalInfo?: StayPracticalInfo; roomGuide?: RoomGuide } {
  if (!canReleaseArrivalInstructions(booking, dueAt, now)) return { arrivalInformationAvailable: false, instructions: '' };
  return { arrivalInformationAvailable: true, instructions: typeof access?.instructions === 'string' ? access.instructions : '', practicalInfo: normalizePracticalInfo(access?.practicalInfo), ...(roomGuide ? { roomGuide } : {}) };
}
