export const MAX_CHECKIN_PHOTOS_PER_AREA = 5;

/** Each photo is stored once, in its assessment, to fit the report's storage budget. */
export function compactCheckinComments(comments: string): string {
  let data: any;
  try { data = JSON.parse(comments); } catch { return comments; }
  if (!data?.assessments || typeof data.assessments !== 'object') return comments;
  const nonConformities: Record<string, unknown>[] = [];
  for (const area of ['ROOM', 'COMMONS']) {
    const assessment = data.assessments[area];
    if (!assessment) continue;
    if (!Array.isArray(assessment.photos) || assessment.photos.length > MAX_CHECKIN_PHOTOS_PER_AREA) throw new Error('Cinq photos maximum par espace.');
    if (assessment.comment === undefined) assessment.comment = '';
    if (typeof assessment.comment !== 'string' || assessment.comment.length > 4500) throw new Error('Le commentaire est trop long (4 500 caractères maximum).');
    if (['clean', 'tidy', 'conditionOk'].some(key => assessment[key] === false)) {
      nonConformities.push({ area, clean: assessment.clean, tidy: assessment.tidy, conditionOk: assessment.conditionOk, comment: assessment.comment });
    }
  }
  return JSON.stringify({ ...data, nonConformities });
}
