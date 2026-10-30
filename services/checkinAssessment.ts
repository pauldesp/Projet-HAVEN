export const CHECKIN_VERSION = 'haven-arrival-v2';
export const CHECKIN_QUESTIONS = {
  ROOM: { clean: 'Propre', tidy: 'Rangé', conditionOk: 'Bon état général', equipmentOk: 'Équipements présents et fonctionnels, conformes à l’annonce', furnitureOk: 'Mobilier présent et en bon état, conforme à l’annonce' },
  COMMONS: { clean: 'Propre', tidy: 'Rangé', conditionOk: 'Bon état général', equipmentOk: 'Équipements présents et fonctionnels, conformes à l’annonce', furnitureOk: 'Mobilier présent et en bon état, conforme à l’annonce' },
  ARRIVAL: { accessInstructionsOk: 'Les indications reçues m’ont permis d’accéder au logement et de trouver ma chambre', keysOk: 'J’ai récupéré les clés ou le moyen d’accès prévu et ils fonctionnent' },
} as const;
export type CheckinArea = keyof typeof CHECKIN_QUESTIONS;
export const CHECKIN_AREAS = Object.keys(CHECKIN_QUESTIONS) as CheckinArea[];
export type CheckinField = 'clean' | 'tidy' | 'conditionOk' | 'equipmentOk' | 'furnitureOk' | 'accessInstructionsOk' | 'keysOk';
export type CheckinAssessment = Partial<Record<CheckinField, boolean | null>> & { comment: string; photos: string[] };
export function emptyCheckinAssessments(): Record<CheckinArea, CheckinAssessment> {
  return Object.fromEntries(CHECKIN_AREAS.map(area => [area, { ...Object.fromEntries(Object.keys(CHECKIN_QUESTIONS[area]).map(key => [key, null])), comment: '', photos: [] }])) as Record<CheckinArea, CheckinAssessment>;
}
export const checkinHasIssue = (assessment: CheckinAssessment) => Object.keys(assessment).some(key => key !== 'comment' && key !== 'photos' && assessment[key as CheckinField] === false);
