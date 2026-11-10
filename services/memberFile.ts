import type { Booking, Incident, OwnerPayout, Payment, Report, Review } from '../types';

export interface AdminNote { id: string; userId: string; text: string; authorId: string; authorName: string; createdAt: string }
export interface MemberEvent { at: string; kind: 'BOOKING' | 'PAYMENT' | 'PAYOUT' | 'REPORT' | 'INCIDENT' | 'REVIEW' | 'MAIL' | 'ADMIN' | 'NOTE'; label: string; detail?: string }
export interface MemberFileSources {
  userId: string;
  bookings: Booking[]; payments: Payment[]; payouts: OwnerPayout[]; reports: Report[]; incidents: Incident[]; reviews: Review[];
  mails: { id: string; kind: string; status: string; occurredAt?: string; sentAt?: string }[];
  audit: { action: string; actorName: string; summary?: string; createdAt: string }[];
  notes: AdminNote[];
}
export interface MemberFile {
  counters: { stays: number; ownerStays: number; cancelled: number; paidAsTenant: number; earnedAsOwner: number; reportsMade: number; reportsReceived: number; incidents: number; reviews: number };
  events: MemberEvent[];
  notes: AdminNote[];
}

const euros = (value: number) => value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const STATUS: Record<string, string> = { PENDING: 'en attente', APPROVED: 'acceptée', CONFIRMED: 'confirmée', COMPLETED: 'terminée', CANCELLED: 'annulée' };

/** Everything Haven knows about a member, as counters and a single timeline, newest first. */
export function buildMemberFile(sources: MemberFileSources): MemberFile {
  const { userId } = sources;
  const asTenant = sources.bookings.filter(booking => booking.tenantId === userId);
  const asOwner = sources.bookings.filter(booking => booking.ownerId === userId);
  const paid = (list: Booking[]) => list.filter(booking => booking.paymentStatus === 'PAID');
  const events: MemberEvent[] = [];
  for (const booking of sources.bookings) {
    const role = booking.tenantId === userId ? 'Séjour réservé' : 'Séjour reçu';
    events.push({ at: booking.createdAt, kind: 'BOOKING', label: `${role} · ${booking.listingTitle || 'Logement'} · ${STATUS[booking.status] || booking.status}`, detail: `Du ${booking.startDate} au ${booking.endDate} · ${euros(booking.totalPrice)}${booking.seriesId ? ` · série (séjour ${(booking.seriesIndex ?? 0) + 1}/${booking.seriesCount})` : ''}` });
    if (booking.cancellation) events.push({ at: booking.cancellation.cancelledAt, kind: 'BOOKING', label: `Annulation ${booking.cancellation.cancelledBy === 'TENANT' ? 'par le locataire' : booking.cancellation.cancelledBy === 'OWNER' ? 'par le propriétaire' : 'par Haven'}`, detail: `${booking.listingTitle || 'Logement'} · ${booking.cancellation.reason} · remboursé ${euros(booking.cancellation.refundAmount)}` });
    for (const refund of booking.havenRefunds || []) events.push({ at: refund.at, kind: 'PAYMENT', label: `Remboursement par Haven : ${euros(refund.amountCents / 100)}`, detail: `${refund.reason} · par ${refund.adminName}` });
  }
  for (const payment of sources.payments) events.push({ at: payment.createdAt, kind: 'PAYMENT', label: `${payment.type === 'REFUND' ? 'Remboursement' : 'Paiement'} de ${euros(payment.amount)}${payment.isTest ? ' (test)' : ''}`, detail: `Réservation ${payment.bookingId}` });
  for (const payout of sources.payouts) events.push({ at: payout.paidAt || payout.createdAt, kind: 'PAYOUT', label: `Virement de ${euros(payout.amountCents / 100)} · ${payout.status === 'PAID' ? 'versé' : payout.status === 'FAILED' ? 'échoué' : 'en cours'}`, detail: payout.providerPayoutId });
  for (const report of sources.reports) events.push({ at: report.timestamp, kind: 'REPORT', label: report.reporterId === userId ? 'Signalement envoyé' : 'Signalement le concernant', detail: `${report.supportCategory || report.reason} · ${report.status} · ${report.description.slice(0, 160)}` });
  for (const incident of sources.incidents) events.push({ at: incident.createdAt, kind: 'INCIDENT', label: incident.reporterId === userId ? `Incident déclaré : ${incident.title}` : `Incident reçu : ${incident.title}`, detail: incident.status });
  for (const review of sources.reviews) events.push({ at: review.createdAt, kind: 'REVIEW', label: review.authorId === userId ? `Avis donné : ${review.rating}/5` : `Avis reçu : ${review.rating}/5`, detail: review.comment?.slice(0, 160) });
  for (const mail of sources.mails) events.push({ at: mail.sentAt || mail.occurredAt || '', kind: 'MAIL', label: `E-mail ${mail.kind}`, detail: mail.status });
  for (const entry of sources.audit) events.push({ at: entry.createdAt, kind: 'ADMIN', label: `Action Haven · ${entry.action}`, detail: `${entry.summary || ''} (${entry.actorName})` });
  return {
    counters: {
      stays: asTenant.filter(booking => booking.status !== 'CANCELLED' && booking.paymentStatus === 'PAID').length,
      ownerStays: asOwner.filter(booking => booking.status !== 'CANCELLED' && booking.paymentStatus === 'PAID').length,
      cancelled: sources.bookings.filter(booking => booking.status === 'CANCELLED' && booking.cancellation).length,
      // Net of refunds (cancellations and Haven goodwill refunds).
      paidAsTenant: paid(asTenant).reduce((sum, booking) => sum + booking.totalPrice - (booking.cancellation?.refundAmount || 0) - (booking.havenRefunds || []).reduce((total, refund) => total + refund.amountCents / 100, 0), 0),
      earnedAsOwner: sources.payouts.filter(payout => payout.status === 'PAID').reduce((sum, payout) => sum + payout.amountCents / 100, 0),
      reportsMade: sources.reports.filter(report => report.reporterId === userId).length,
      reportsReceived: sources.reports.filter(report => report.reporterId !== userId).length,
      incidents: sources.incidents.length,
      reviews: sources.reviews.length,
    },
    events: events.filter(event => event.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 150),
    notes: [...sources.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
