import type { AdminAuditEntry, User, Listing, Report, Incident, ContactRequest, Booking, LegalDocument } from '../types';
export const auditCategoryLabels: Record<AdminAuditEntry['category'], string> = {
  ACCOUNT: 'Comptes', LISTING: 'Annonces', BOOKING: 'Réservations', INCIDENT: 'Incidents', LEGAL: 'Documents légaux', REPORT: 'Signalements', CONTACT: 'Contacts', ADMINISTRATION: 'Administrateurs'
};
const actions: Record<string, string> = {
  USER_TEST_APPROVED: 'Compte validé exceptionnellement (test)', USER_TEST_REVOKED: 'Dérogation de compte retirée',
  LISTING_TEST_APPROVED: 'Annonce validée exceptionnellement (test)', LISTING_TEST_REVOKED: 'Dérogation d’annonce retirée',
  USER_APPROVED: 'Profil validé', USER_REJECTED: 'Dossier refusé', USER_BANNED: 'Compte banni', USER_PENDING: 'Compte remis en attente', USER_IDENTITY_VERIFIED: 'Identité vérifiée',
  LISTING_APPROVED: 'Annonce validée', LISTING_REJECTED: 'Annonce refusée', LISTING_PENDING: 'Annonce remise en attente',
  ADMIN_GRANTED: 'Accès administrateur accordé', ADMIN_REVOKED: 'Accès administrateur retiré',
  LEGAL_CREATED: 'Document légal créé', LEGAL_UPDATED: 'Document légal modifié',
  REPORT_INVESTIGATING: 'Signalement en cours d’examen', REPORT_WAITING_OWNER: 'Attente du propriétaire décidée', REPORT_RESOLVED: 'Signalement résolu', REPORT_DISMISSED: 'Signalement classé',
  CONTACT_NEW: 'Contact remis en attente', CONTACT_IN_PROGRESS: 'Contact pris en charge', CONTACT_RESOLVED: 'Demande de contact résolue',
  INCIDENT_RESOLVED: 'Incident marqué résolu'
};
export const auditActionLabel = (action: string) => actions[action] || 'Action administrative';
export function auditStatusLabel(status: string) {
  return ({ NEW: 'Nouveau', PENDING: 'En attente', APPROVED: 'Validé', REJECTED: 'Refusé', BANNED: 'Banni', INVESTIGATING: 'En cours d’examen', WAITING_OWNER: 'En attente du propriétaire', RESOLVED: 'Résolu', DISMISSED: 'Classé sans suite', IN_PROGRESS: 'En cours', DRAFT: 'Brouillon' } as Record<string, string>)[status] || status;
}
export const readableAuditSummary = (summary: string) => summary.replace(/\b(NEW|PENDING|APPROVED|REJECTED|BANNED|INVESTIGATING|WAITING_OWNER|RESOLVED|DISMISSED|IN_PROGRESS|DRAFT)\b/g, auditStatusLabel);
export function buildAuditTargetSnapshot(targetType: string, data: Record<string, unknown>) {
  const text = (key: string) => typeof data[key] === 'string' ? (data[key] as string).trim() : '';
  let targetLabel = ''; let targetDescription = '';
  if (targetType === 'USER') { targetLabel = [text('firstName'), text('lastName')].filter(Boolean).join(' '); targetDescription = text('email'); }
  else if (targetType === 'LISTING') { targetLabel = text('title'); targetDescription = text('city'); }
  else if (targetType === 'REPORT') { targetLabel = text('supportCategory') || 'Signalement'; targetDescription = text('description').slice(0, 140); }
  else if (targetType === 'INCIDENT') { targetLabel = text('title'); targetDescription = text('description').slice(0, 140); }
  else if (targetType === 'CONTACT_REQUEST') { targetLabel = text('name'); targetDescription = text('subject'); }
  else if (targetType === 'BOOKING') { targetLabel = 'Réservation'; targetDescription = [text('startDate'), text('endDate')].filter(Boolean).join(' → '); }
  else if (targetType === 'LEGAL_DOCUMENT') { targetLabel = text('title'); }
  return targetLabel ? { targetLabel, targetDescription } : {};
}
export type AuditContext = { users: User[]; listings: Listing[]; reports: Report[]; incidents: Incident[]; contacts: ContactRequest[]; bookings: Booking[]; legalDocs: LegalDocument[] };
export function resolveAuditTarget(entry: AdminAuditEntry, context: AuditContext): { label: string; description: string; historical: boolean; available: boolean } {
  const groups: Record<string, { id: string }[]> = { USER: context.users, LISTING: context.listings, REPORT: context.reports, INCIDENT: context.incidents, CONTACT_REQUEST: context.contacts, BOOKING: context.bookings, LEGAL_DOCUMENT: context.legalDocs };
  const item = groups[entry.targetType]?.find(value => value.id === entry.targetId);
  const live = item ? buildAuditTargetSnapshot(entry.targetType, item as unknown as Record<string, unknown>) : {};
  const labels: Record<string, string> = { USER: 'Profil', LISTING: 'Annonce', REPORT: 'Signalement', INCIDENT: 'Incident', CONTACT_REQUEST: 'Demande de contact', BOOKING: 'Réservation', LEGAL_DOCUMENT: 'Document légal' };
  return { label: entry.targetLabel || live.targetLabel || `${labels[entry.targetType] || 'Élément'} indisponible`, description: entry.targetLabel ? entry.targetDescription || '' : live.targetDescription || '', historical: Boolean(entry.targetLabel), available: Boolean(item) };
}
export type AuditFilter = { actorId: string; category: string; action: string; query: string; from: string; to: string };
export const initialAuditFilter: AuditFilter = { actorId: 'ALL', category: 'ALL', action: 'ALL', query: '', from: '', to: '' };
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function filterAuditEntries(entries: AdminAuditEntry[], filter: AuditFilter, context: AuditContext) {
  return entries.filter(entry => {
    if (filter.actorId !== 'ALL' && entry.actorId !== filter.actorId || filter.category !== 'ALL' && entry.category !== filter.category || filter.action !== 'ALL' && entry.action !== filter.action) return false;
    const timestamp = Date.parse(entry.createdAt);
    if (filter.from && (!Number.isFinite(timestamp) || timestamp < Date.parse(`${filter.from}T00:00:00`))) return false;
    if (filter.to) { const end = new Date(`${filter.to}T00:00:00`); end.setDate(end.getDate() + 1); if (!Number.isFinite(timestamp) || timestamp >= end.getTime()) return false; }
    const target = resolveAuditTarget(entry, context);
    return normalized(`${entry.actorName} ${auditActionLabel(entry.action)} ${auditCategoryLabels[entry.category] || entry.category} ${target.label} ${target.description} ${readableAuditSummary(entry.summary)} ${entry.targetId}`).includes(normalized(filter.query.trim()));
  }).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}
