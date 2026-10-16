import type { Incident } from '../types';
export class OwnerIncidentError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
export function prepareOwnerIncidentUpdate(incident: Incident, actorId: string, status: unknown, notes: unknown, now = new Date().toISOString()) {
  if (incident.ownerId !== actorId) throw new OwnerIncidentError('Seul le propriétaire concerné peut gérer cet incident.', 403);
  if (status !== 'INVESTIGATING' && status !== 'RESOLVED') throw new OwnerIncidentError('Statut invalide.');
  if (!['NEW', 'INVESTIGATING'].includes(incident.status)) throw new OwnerIncidentError('Cet incident est déjà clôturé.', 409);
  if (typeof notes !== 'string' || notes.length > 2000) throw new OwnerIncidentError('La note doit faire au maximum 2 000 caractères.');
  return { status: status as 'INVESTIGATING' | 'RESOLVED', takenInChargeAt: incident.takenInChargeAt || now, ownerNotes: notes.trim(), updatedBy: actorId, updatedAt: now, ...(status === 'RESOLVED' ? { resolvedAt: now } : {}) };
}
