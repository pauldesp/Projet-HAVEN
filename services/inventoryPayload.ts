import { CHECKIN_VERSION, CHECKIN_QUESTIONS } from './checkinAssessment';
export const MAX_CHECKIN_PHOTOS_PER_AREA = 5;

/** Each photo is stored once, in its assessment, to fit the report's storage budget. */
export function compactCheckinComments(comments: string): string {
  let data: any;
  try { data = JSON.parse(comments); } catch { return comments; }
  if (!data?.assessments || typeof data.assessments !== 'object') return comments;
  const nonConformities: Record<string, unknown>[] = [];
  for (const area of ['ROOM', 'COMMONS', 'ARRIVAL'] as const) {
    const assessment = data.assessments[area];
    if (!assessment) { if (data.checkinVersion === CHECKIN_VERSION) throw new Error('Terminez les contrôles de votre arrivée.'); continue; }
    if (!Array.isArray(assessment.photos) || assessment.photos.length > (area === 'ARRIVAL' ? 2 : MAX_CHECKIN_PHOTOS_PER_AREA)) throw new Error('Cinq photos maximum par espace.');
    if (assessment.comment === undefined) assessment.comment = '';
    if (typeof assessment.comment !== 'string' || assessment.comment.length > 4500) throw new Error('Le commentaire est trop long (4 500 caractères maximum).');
    const fields = Object.keys(CHECKIN_QUESTIONS[area]);
    if (data.checkinVersion === CHECKIN_VERSION && fields.some(key => typeof assessment[key] !== 'boolean')) throw new Error('Répondez à tous les contrôles de votre arrivée.');
    if (fields.some(key => assessment[key] === false)) {
      if (data.checkinVersion === CHECKIN_VERSION && (assessment.comment.trim().length < 5 || area !== 'ARRIVAL' && assessment.photos.length < 1)) throw new Error('Décrivez chaque problème et ajoutez une photo pour la chambre ou les espaces communs.');
      nonConformities.push({ area, ...Object.fromEntries(fields.filter(key => typeof assessment[key] === 'boolean').map(key => [key, assessment[key]])), comment: assessment.comment });
    }
  }
  return JSON.stringify({ ...data, nonConformities });
}
