import type { Incident, Report, ReportStatus } from '../types';

export class ReportFollowUpError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
export function prepareReportFollowUp(report: Report, incident: Incident | undefined, status: unknown, note: unknown, reviewDate: unknown, actorId: string, now = new Date().toISOString()) {
  if (typeof status !== 'string' || !['INVESTIGATING', 'WAITING_OWNER', 'RESOLVED', 'DISMISSED'].includes(status)) throw new ReportFollowUpError('Décision invalide.');
  if (['RESOLVED', 'DISMISSED'].includes(report.status)) throw new ReportFollowUpError('Ce signalement est déjà clôturé.', 409);
  if (note !== undefined && (typeof note !== 'string' || note.length > 2000)) throw new ReportFollowUpError('La note doit faire au maximum 2 000 caractères.');
  let date: string | null = null;
  if (status === 'WAITING_OWNER') {
    if (!incident || report.incidentId !== incident.id || !incident.ownerId) throw new ReportFollowUpError('Un incident et son propriétaire doivent être identifiés.');
    if (!['NEW', 'INVESTIGATING'].includes(incident.status)) throw new ReportFollowUpError('L’incident lié est déjà clôturé.');
    if (typeof note !== 'string' || !note.trim()) throw new ReportFollowUpError('Indiquez le message destiné au locataire et au propriétaire.');
    if (reviewDate) {
      if (typeof reviewDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(reviewDate) || Number.isNaN(Date.parse(`${reviewDate}T12:00:00Z`)) || new Date(`${reviewDate}T12:00:00Z`).toISOString().slice(0, 10) !== reviewDate) throw new ReportFollowUpError('Date de réexamen invalide.');
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
      const today = ['year', 'month', 'day'].map(key => parts.find(part => part.type === key)!.value).join('-');
      if (reviewDate < today) throw new ReportFollowUpError('La date de réexamen ne peut pas être passée.');
      date = reviewDate;
    }
  }
  const decision = status as ReportStatus;
  const publicNote = decision === 'WAITING_OWNER' ? (note as string).trim() : decision === 'INVESTIGATING' ? 'Haven a repris l’examen du signalement.' : decision === 'RESOLVED' ? 'Haven a marqué le signalement comme résolu.' : 'Haven a classé le signalement sans suite.';
  return {
    reportUpdate: {
      status: decision, updatedAt: now, handledBy: actorId, adminNotes: typeof note === 'string' ? note.trim() : report.adminNotes || '',
      ownerReviewDate: date,
      ...(decision === 'WAITING_OWNER' ? { ownerMessage: publicNote, waitingOwnerSince: report.waitingOwnerSince || now } : {})
    },
    incidentUpdate: incident ? { havenFollowUp: { status: decision, note: publicNote, reviewDate: date, updatedAt: now } } : undefined
  };
}
