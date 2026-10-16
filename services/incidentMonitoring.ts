import type { Incident, Report } from '../types';

export function isOpenIncident(incident: Incident): boolean { return incident.status === 'NEW' || incident.status === 'INVESTIGATING'; }
export type IncidentFilter = {
  status: 'ALL' | 'OPEN' | 'NEW' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED' | 'ESCALATED';
  search: string; listingId: string; ownerId: string; from: string; to: string;
  sort: 'NEWEST' | 'OLDEST' | 'PRIORITY' | 'RESOLVED';
};
export const initialIncidentFilter: IncidentFilter = { status: 'OPEN', search: '', listingId: '', ownerId: '', from: '', to: '', sort: 'OLDEST' };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function filterAndSortIncidents(incidents: Incident[], filter: IncidentFilter, labels: (incident: Incident) => string = () => ''): Incident[] {
  const result = incidents.filter(incident => {
    if (filter.status === 'OPEN' && !isOpenIncident(incident)) return false;
    if (filter.status === 'ESCALATED' && !incident.escalatedAt) return false;
    if (!['ALL', 'OPEN', 'ESCALATED'].includes(filter.status) && filter.status !== incident.status) return false;
    if (filter.listingId && incident.listingId !== filter.listingId) return false;
    if (filter.ownerId && incident.ownerId !== filter.ownerId) return false;
    const created = Date.parse(incident.createdAt);
    if (filter.from && (!Number.isFinite(created) || created < Date.parse(`${filter.from}T00:00:00`))) return false;
    if (filter.to) {
      const end = new Date(`${filter.to}T00:00:00`);
      end.setDate(end.getDate() + 1);
      if (!Number.isFinite(created) || created >= end.getTime()) return false;
    }
    return normalize(`${incident.id} ${incident.title} ${incident.description} ${labels(incident)}`).includes(normalize(filter.search.trim()));
  });
  const priority = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  return result.sort((a, b) => {
    if (filter.sort === 'PRIORITY') return (priority[b.priority || 'MEDIUM'] - priority[a.priority || 'MEDIUM']) || Date.parse(a.createdAt) - Date.parse(b.createdAt);
    if (filter.sort === 'RESOLVED') return (Date.parse(b.resolvedAt || '') || 0) - (Date.parse(a.resolvedAt || '') || 0);
    const difference = (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0);
    return filter.sort === 'OLDEST' ? difference : -difference;
  });
}
export class IncidentEscalationError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
export function prepareIncidentEscalation(incident: Incident, actorId: string, reason: unknown, reportId: string, now = new Date().toISOString()): { report: Report; update: Partial<Incident> } {
  if (incident.reporterId !== actorId) throw new IncidentEscalationError('Seul l’auteur de l’incident peut demander l’intervention de Haven.', 403);
  if (!isOpenIncident(incident)) throw new IncidentEscalationError('Cet incident est déjà clôturé.', 409);
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 2000) throw new IncidentEscalationError('Expliquez votre demande en 1 à 2 000 caractères.');
  return {
    report: {
      id: reportId, reporterId: actorId, targetId: incident.listingId, targetType: 'LISTING', reason: 'OTHER',
      supportCategory: 'Incident non résolu', incidentId: incident.id, bookingId: incident.bookingId || '',
      listingId: incident.listingId, ownerId: incident.ownerId || '',
      description: `${incident.title}\nIncident déclaré le ${incident.createdAt}.\n\n${reason.trim()}\n\nDéclaration initiale : ${incident.description}`,
      photos: incident.photos || [], status: 'NEW', timestamp: now
    },
    update: { escalatedAt: now, escalationReportId: reportId }
  };
}
