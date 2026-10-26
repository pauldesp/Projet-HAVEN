import type { Booking } from '../types';
import { isStayReviewWindowOpen } from './reviewPolicy';
import { withLayout } from './reservationMail';

export type TenantMailKind = 'ACCOUNT_APPROVED' | 'ACCOUNT_CORRECTION' | 'CANCELLED' | 'REVIEW_INVITE';
export interface TenantMailJob {
  kind: TenantMailKind; userId: string; bookingId?: string; occurredAt: string;
  status: 'PENDING'; attempts: number; nextAttemptAt: string; decisionId?: string; exceptional?: boolean;
}
export interface TenantMailProfile {
  role?: string; status?: string; firstName?: string; email?: string; rejectionReason?: string;
  approvedAt?: string; moderatedAt?: string; verificationException?: { decisionId?: string } | null;
}
export function isTenantMailKind(value: unknown): value is TenantMailKind {
  return ['ACCOUNT_APPROVED', 'ACCOUNT_CORRECTION', 'CANCELLED', 'REVIEW_INVITE'].includes(String(value));
}
export function accountDecisionMail(userId: string, profile: TenantMailProfile, kind: 'ACCOUNT_APPROVED' | 'ACCOUNT_CORRECTION', at: string, decisionId?: string): TenantMailJob | undefined {
  if (profile.role !== 'TENANT') return undefined;
  return { kind, userId, occurredAt: at, status: 'PENDING', attempts: 0, nextAttemptAt: at,
    ...(decisionId ? { decisionId, exceptional: true } : {}) };
}
export function cancellationMail(booking: Booking): TenantMailJob | undefined {
  if (booking.status !== 'CANCELLED' || booking.paymentStatus !== 'PAID' || !booking.cancellation?.cancelledAt) return undefined;
  return { kind: 'CANCELLED', userId: booking.tenantId, bookingId: booking.id, occurredAt: booking.cancellation.cancelledAt, status: 'PENDING', attempts: 0, nextAttemptAt: booking.cancellation.cancelledAt };
}
export function reviewInvitationMail(booking: Booking): TenantMailJob | undefined {
  if (booking.status !== 'COMPLETED' || booking.paymentStatus !== 'PAID' || !booking.completedAt || !booking.checkOutReportId) return undefined;
  return { kind: 'REVIEW_INVITE', userId: booking.tenantId, bookingId: booking.id, occurredAt: booking.completedAt,
    status: 'PENDING', attempts: 0, nextAttemptAt: new Date(Date.parse(booking.completedAt) + 24 * 3600_000).toISOString() };
}
export function tenantMailDisposition(job: TenantMailJob, profile: TenantMailProfile | undefined, booking: Booking | undefined, hasReview: boolean, startAt: string, now = Date.now()): 'SEND' | 'WAIT' | 'CANCELLED' | 'EXPIRED' {
  const occurred = Date.parse(job.occurredAt);
  if (!Number.isFinite(occurred) || !Number.isFinite(Date.parse(startAt)) || occurred < Date.parse(startAt)) return 'CANCELLED';
  if (now - occurred >= 7 * 86400_000) return 'EXPIRED';
  if (!profile) return 'CANCELLED';
  if (job.kind === 'ACCOUNT_APPROVED' || job.kind === 'ACCOUNT_CORRECTION') {
    if (profile.role !== 'TENANT') return 'CANCELLED';
    const current = job.kind === 'ACCOUNT_APPROVED'
      ? profile.status === 'APPROVED' && (job.exceptional ? profile.verificationException?.decisionId === job.decisionId : !profile.verificationException && profile.approvedAt === job.occurredAt)
      : profile.status === 'REJECTED' && profile.moderatedAt === job.occurredAt;
    return current ? 'SEND' : 'CANCELLED';
  }
  if (!booking || booking.id !== job.bookingId || booking.tenantId !== job.userId || booking.paymentStatus !== 'PAID') return 'CANCELLED';
  if (job.kind === 'CANCELLED') return booking.status === 'CANCELLED' && booking.cancellation?.cancelledAt === job.occurredAt ? 'SEND' : 'CANCELLED';
  if (booking.status !== 'COMPLETED' || booking.completedAt !== job.occurredAt || !booking.checkOutReportId || hasReview) return 'CANCELLED';
  if (!isStayReviewWindowOpen(booking.completedAt, booking.endDate, now)) return 'EXPIRED';
  return now < occurred + 24 * 3600_000 ? 'WAIT' : 'SEND';
}
export function tenantNotificationEmail(job: TenantMailJob, profile: TenantMailProfile, booking?: Booking, listingTitle?: string, appOrigin?: string) {
  const test = job.exceptional || booking?.paymentIsTest || booking?.paymentProvider === 'SIMULATION';
  const date = (value: string) => value.slice(0, 10).split('-').reverse().join('/');
  const title = booking?.listingTitle || listingTitle || 'Votre séjour Haven';
  let subject: string, body: string;
  if (job.kind === 'ACCOUNT_APPROVED') {
    subject = 'Votre compte Haven est validé';
    body = job.exceptional
      ? 'Une validation exceptionnelle de test a été accordée à votre compte. Vous pouvez poursuivre vos essais de réservation sur Haven.'
      : 'Votre dossier a été validé par Haven. Vous pouvez maintenant réserver votre prochain séjour.';
  } else if (job.kind === 'ACCOUNT_CORRECTION') {
    subject = 'Votre dossier Haven est à corriger';
    body = `Votre dossier nécessite une correction avant de pouvoir être validé.\n\nÉléments à corriger :\n${profile.rejectionReason || 'Consultez les indications dans votre espace personnel.'}\n\nOuvrez votre espace personnel, mettez à jour les éléments demandés puis transmettez à nouveau votre dossier à Haven.`;
  } else if (job.kind === 'CANCELLED' && booking?.cancellation) {
    const cancellation = booking.cancellation;
    subject = `Réservation annulée — ${title}`;
    const amount = cancellation.refundAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
    const refund = cancellation.refundStatus === 'SIMULATED' ? `Remboursement simulé : ${amount}. Aucun remboursement bancaire réel n’a été effectué.`
      : cancellation.refundAmount > 0 ? `Remboursement enregistré : ${amount}. Le délai d’apparition sur votre compte dépend du prestataire de paiement et de votre banque.`
      : 'Aucun remboursement n’est enregistré pour cette annulation.';
    body = `Votre réservation a été annulée${cancellation.cancelledBy === 'OWNER' ? ' par le propriétaire' : ' à votre demande'}.\n\n${title}${booking.roomName ? ` — ${booking.roomName}` : ''}\nDu ${date(booking.startDate)} au ${date(booking.endDate)}.\nMotif : ${cancellation.reason}\n\n${refund}\n\nRetrouvez le récapitulatif dans votre espace personnel.\nRéférence : ${booking.id}`;
  } else if (job.kind === 'REVIEW_INVITE' && booking) {
    subject = `Comment s’est passé votre séjour chez ${title} ?`;
    body = `Nous espérons que votre séjour s’est bien passé.\n\n${title}${booking.roomName ? ` — ${booking.roomName}` : ''}\nDu ${date(booking.startDate)} au ${date(booking.endDate)}.\n\nPrenez un moment pour partager votre expérience. Votre avis aide les prochains locataires à choisir leur logement.\n\nDans Mes séjours, ouvrez l’Historique puis choisissez « Noter ». Vous disposez de 7 jours après la fin du séjour pour le publier.\nRéférence : ${booking.id}`;
  } else throw new Error('Événement e-mail incomplet.');
  const text = `${test ? 'TEST — notification de démonstration.\n\n' : ''}Bonjour ${profile.firstName || 'à vous'},\n\n${body}\n\nL’équipe Haven`;
  return withLayout(`${test ? '[TEST] ' : ''}${subject}`, text, { listingTitle: job.kind.startsWith('ACCOUNT_') ? 'Votre compte Haven' : title }, appOrigin, job.kind.startsWith('ACCOUNT_') ? 'Mon compte' : 'Mes séjours');
}
