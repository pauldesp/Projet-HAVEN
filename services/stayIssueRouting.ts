import type { Incident, Report, ReportReason } from '../types';

export const HAVEN_REPORT_REASONS = [
  { id: 'CONFLICT', label: 'Conflit / comportement inadapté', reason: 'OTHER' },
  { id: 'UNSANITARY', label: 'Logement insalubre', reason: 'OTHER' },
  { id: 'CLEANING', label: 'Ménage non fait', reason: 'OTHER' },
  { id: 'INACCURATE', label: 'Annonce mensongère', reason: 'INACCURATE' },
  { id: 'FRAUD', label: 'Arnaque / fraude', reason: 'FRAUD' },
  { id: 'OFFENSIVE', label: 'Contenu inapproprié', reason: 'OFFENSIVE' },
  { id: 'SPAM', label: 'Spam', reason: 'SPAM' },
  { id: 'OTHER', label: 'Autre demande d’intervention', reason: 'OTHER' }
] as const;

export function stayIssueDestination(category: string, subCategory: string): 'OWNER' | 'HAVEN' {
  return category === 'Voisinage / vie en colocation' || category === 'Nuisibles / hygiène' ||
    subCategory === 'Ménage non fait' || subCategory === 'Logement insalubre' ? 'HAVEN' : 'OWNER';
}

export function routeStayIssue(input: {
  id: string; bookingId: string; listingId: string; ownerId: string; reporterId: string;
  category: string; subCategory: string; description: string; photo?: string;
  priority?: Incident['priority']; createdAt: string;
}): { destination: 'OWNER'; incident: Incident } | { destination: 'HAVEN'; report: Report } {
  if (![input.bookingId, input.listingId, input.ownerId, input.reporterId, input.category, input.subCategory, input.description].every(value => typeof value === 'string' && value.trim())) throw new Error('Le séjour et la description du problème sont obligatoires.');
  if (input.description.trim().length >= 5000) throw new Error('La description doit faire moins de 5 000 caractères.');
  if (input.photo && (typeof input.photo !== 'string' || input.photo.length > 850 * 1024 || (!input.photo.startsWith('data:image/') && !input.photo.startsWith('https://')))) throw new Error('La photo doit être une image optimisée de 600 Ko maximum.');
  if (input.priority && !['LOW', 'MEDIUM', 'HIGH'].includes(input.priority)) throw new Error('Priorité invalide.');
  const title = `${input.category} - ${input.subCategory}`;
  if (stayIssueDestination(input.category, input.subCategory) === 'HAVEN') return {
    destination: 'HAVEN', report: {
      id: input.id, reporterId: input.reporterId, targetId: input.listingId, targetType: 'LISTING',
      bookingId: input.bookingId, listingId: input.listingId, ownerId: input.ownerId,
      reason: 'OTHER', supportCategory: title, description: input.description.trim(),
      status: 'NEW', timestamp: input.createdAt, photos: input.photo ? [input.photo] : []
    }
  };
  return { destination: 'OWNER', incident: {
    id: input.id, bookingId: input.bookingId, listingId: input.listingId, ownerId: input.ownerId,
    reporterId: input.reporterId, title, description: input.description.trim(), status: 'NEW',
    createdAt: input.createdAt, photos: input.photo ? [input.photo] : [], priority: input.priority || 'MEDIUM'
  } };
}

export function havenReportReason(choice: string): { reason: ReportReason; supportCategory: string } {
  const selected = HAVEN_REPORT_REASONS.find(option => option.id === choice);
  if (!selected) throw new Error('Choisissez le motif du signalement.');
  return { reason: selected.reason, supportCategory: selected.label };
}

export function createIssueId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `issue_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

export function bindStayIssueToBooking(booking: { tenantId: string; listingId: string; ownerId: string; status: string }, actorId: string, input: Parameters<typeof routeStayIssue>[0]) {
  if (booking.tenantId !== actorId) throw new Error('Seul le locataire de ce séjour peut déclarer cet incident.');
  if (!['APPROVED', 'CONFIRMED', 'COMPLETED'].includes(booking.status)) throw new Error('Ce séjour ne permet pas de déclarer un incident.');
  return { ...input, reporterId: actorId, listingId: booking.listingId, ownerId: booking.ownerId };
}
