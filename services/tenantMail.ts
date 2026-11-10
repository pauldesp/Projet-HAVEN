import type { Booking, BookingSeries } from '../types';
import { installmentDeadline, nextInstallmentAttempt } from './recurringInstallments';
import { isStayReviewWindowOpen } from './reviewPolicy';
import { withLayout } from './reservationMail';

export type SeriesMailKind = 'SERIES_CONFIRMED' | 'INSTALLMENT_UPCOMING' | 'INSTALLMENT_FAILED' | 'INSTALLMENT_UNPAID';
export type TenantMailKind = 'ACCOUNT_APPROVED' | 'ACCOUNT_CORRECTION' | 'CANCELLED' | 'REVIEW_INVITE' | SeriesMailKind;
export const SERIES_MAIL_KINDS: readonly SeriesMailKind[] = ['SERIES_CONFIRMED', 'INSTALLMENT_UPCOMING', 'INSTALLMENT_FAILED', 'INSTALLMENT_UNPAID'];
export const isSeriesMailKind = (value: unknown): value is SeriesMailKind => SERIES_MAIL_KINDS.includes(value as SeriesMailKind);
/** Recurring context of a series mail: the series and all its stays. */
export interface SeriesMailContext { series: BookingSeries; stays: Booking[] }
export interface TenantMailJob {
  kind: TenantMailKind; userId: string; bookingId?: string; occurredAt: string;
  status: 'PENDING'; attempts: number; nextAttemptAt: string; decisionId?: string; exceptional?: boolean; seriesId?: string; attempt?: number;
}
export interface TenantMailProfile {
  role?: string; status?: string; firstName?: string; email?: string; rejectionReason?: string;
  approvedAt?: string; moderatedAt?: string; verificationException?: { decisionId?: string } | null;
}
export function isTenantMailKind(value: unknown): value is TenantMailKind {
  return ['ACCOUNT_APPROVED', 'ACCOUNT_CORRECTION', 'CANCELLED', 'REVIEW_INVITE'].includes(String(value)) || isSeriesMailKind(value);
}
export function accountDecisionMail(userId: string, profile: TenantMailProfile, kind: 'ACCOUNT_APPROVED' | 'ACCOUNT_CORRECTION', at: string, decisionId?: string): TenantMailJob | undefined {
  if (profile.role !== 'TENANT') return undefined;
  return { kind, userId, occurredAt: at, status: 'PENDING', attempts: 0, nextAttemptAt: at,
    ...(decisionId ? { decisionId, exceptional: true } : {}) };
}
export function cancellationMail(booking: Booking): TenantMailJob | undefined {
  // A reserved later stay of a recurring series is announced even before it is charged.
  if (booking.status !== 'CANCELLED' || (booking.paymentStatus !== 'PAID' && !booking.seriesScheduled) || !booking.cancellation?.cancelledAt) return undefined;
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
  if (!booking || booking.id !== job.bookingId || booking.tenantId !== job.userId) return 'CANCELLED';
  if (isSeriesMailKind(job.kind)) {
    const unpaidLater = booking.status === 'PENDING' && booking.paymentStatus !== 'PAID' && Boolean(booking.seriesActivatedAt);
    if (job.kind === 'SERIES_CONFIRMED') return booking.paymentStatus === 'PAID' ? 'SEND' : 'CANCELLED';
    if (job.kind === 'INSTALLMENT_UNPAID') return booking.status === 'CANCELLED' && Boolean(booking.unpaidCancelledAt) ? 'SEND' : 'CANCELLED';
    if (job.kind === 'INSTALLMENT_FAILED') return unpaidLater && (booking.installmentAttempts || 0) === job.attempt ? 'SEND' : 'CANCELLED';
    return unpaidLater && (booking.installmentAttempts || 0) === 0 ? 'SEND' : 'CANCELLED';
  }
  if (booking.paymentStatus !== 'PAID' && !(job.kind === 'CANCELLED' && booking.seriesScheduled)) return 'CANCELLED';
  if (job.kind === 'CANCELLED') return booking.status === 'CANCELLED' && booking.cancellation?.cancelledAt === job.occurredAt ? 'SEND' : 'CANCELLED';
  if (booking.status !== 'COMPLETED' || booking.completedAt !== job.occurredAt || !booking.checkOutReportId || hasReview) return 'CANCELLED';
  if (!isStayReviewWindowOpen(booking.completedAt, booking.endDate, now)) return 'EXPIRED';
  return now < occurred + 24 * 3600_000 ? 'WAIT' : 'SEND';
}
export function tenantNotificationEmail(job: TenantMailJob, profile: TenantMailProfile, booking?: Booking, listingTitle?: string, appOrigin?: string, context?: SeriesMailContext) {
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
    const refund = booking.paymentStatus !== 'PAID' && booking.seriesScheduled ? 'Ce séjour n’avait pas encore été prélevé : aucun montant ne vous a été débité.'
      : cancellation.refundStatus === 'SIMULATED' ? `Remboursement simulé : ${amount}. Aucun remboursement bancaire réel n’a été effectué.`
      : cancellation.refundAmount > 0 ? `Remboursement enregistré : ${amount}. Le délai d’apparition sur votre compte dépend du prestataire de paiement et de votre banque.`
      : 'Aucun remboursement n’est enregistré pour cette annulation.';
    body = `Votre réservation a été annulée${cancellation.cancelledBy === 'HAVEN' ? ' par l’équipe Haven' : cancellation.cancelledBy === 'OWNER' ? ' par le propriétaire' : ' à votre demande'}.\n\n${title}${booking.roomName ? ` — ${booking.roomName}` : ''}\nDu ${date(booking.startDate)} au ${date(booking.endDate)}.\nMotif : ${cancellation.reason}\n\n${refund}\n\nRetrouvez le récapitulatif dans votre espace personnel.\nRéférence : ${booking.id}`;
  } else if (job.kind === 'REVIEW_INVITE' && booking) {
    subject = `Comment s’est passé votre séjour chez ${title} ?`;
    body = `Nous espérons que votre séjour s’est bien passé.\n\n${title}${booking.roomName ? ` — ${booking.roomName}` : ''}\nDu ${date(booking.startDate)} au ${date(booking.endDate)}.\n\nPrenez un moment pour partager votre expérience. Votre avis aide les prochains locataires à choisir leur logement.\n\nDans Mes séjours, ouvrez l’Historique puis choisissez « Noter ». Vous disposez de 7 jours après la fin du séjour pour le publier.\nRéférence : ${booking.id}`;
  } else if (isSeriesMailKind(job.kind) && booking) {
    ({ subject, body } = seriesMailContent(job, booking, title, context));
  } else throw new Error('Événement e-mail incomplet.');
  const text = `${test ? 'TEST — notification de démonstration.\n\n' : ''}Bonjour ${profile.firstName || 'à vous'},\n\n${body}\n\nL’équipe Haven`;
  const payNow = job.kind === 'INSTALLMENT_FAILED' && booking ? `/payment/${encodeURIComponent(booking.id)}` : undefined;
  return withLayout(`${test ? '[TEST] ' : ''}${subject}`, text, { listingTitle: job.kind.startsWith('ACCOUNT_') ? 'Votre compte Haven' : title }, appOrigin, job.kind.startsWith('ACCOUNT_') ? 'Mon compte' : payNow ? 'Payer ce séjour' : 'Mes séjours', payNow);
}

const euros = (value: number) => value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const longDate = (value: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
const deadlineText = (at: number) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(at));

export function seriesMailContent(job: TenantMailJob, booking: Booking, title: string, context?: SeriesMailContext): { subject: string; body: string } {
  const position = `séjour ${(booking.seriesIndex ?? 0) + 1}${booking.seriesCount ? ` sur ${booking.seriesCount}` : ''}`;
  const stayLine = `${title}${booking.roomName ? ` — ${booking.roomName}` : ''}\nDu ${longDate(booking.startDate)} au ${longDate(booking.endDate)} (${position}).`;
  const card = context?.series.cardLast4 ? `votre carte ${context.series.cardBrand ? `${context.series.cardBrand.toUpperCase()} ` : ''}se terminant par ${context.series.cardLast4}` : 'la carte utilisée pour votre premier séjour';
  const simulated = context?.series.paymentProvider === 'SIMULATION' || booking.paymentProvider === 'SIMULATION';
  if (job.kind === 'SERIES_CONFIRMED') {
    const stays = [...(context?.stays || [booking])].filter(stay => stay.status !== 'CANCELLED').sort((a, b) => a.startDate.localeCompare(b.startDate));
    const lines = stays.map(stay => `• Séjour ${(stay.seriesIndex ?? 0) + 1} · du ${longDate(stay.startDate)} au ${longDate(stay.endDate)} · ${euros(stay.totalPrice)} · ${stay.paymentStatus === 'PAID' ? 'payé' : `prélevé le ${longDate(stay.installmentDueDate || stay.startDate)}`}`).join('\n');
    const total = stays.reduce((sum, stay) => sum + stay.totalPrice, 0);
    return { subject: `Vos ${stays.length} séjours sont réservés — ${title}`, body: `Votre réservation récurrente est confirmée. Toutes vos dates sont bloquées et leurs prix sont fixés dès aujourd’hui.\n\n${title}${booking.roomName ? ` — ${booking.roomName}` : ''}\n\nVotre échéancier :\n${lines}\n\nTotal de la série : ${euros(total)}.\n\n${simulated ? 'Mode test : les échéances suivantes seront simulées automatiquement, sans débit réel.' : `Les séjours suivants seront prélevés automatiquement sur ${card}, un mois avant chaque arrivée.`} Vous recevrez un rappel 3 jours avant chaque prélèvement, puis la confirmation de chaque séjour.\n\nChaque séjour reste annulable séparément selon les conditions d’annulation : remboursement intégral à 30 jours ou plus de l’arrivée, 50 % entre 14 et 29 jours, aucun remboursement en dessous. Un séjour pas encore prélevé s’annule sans frais.\nRéférence de la série : ${booking.seriesId}` };
  }
  if (job.kind === 'INSTALLMENT_UPCOMING') {
    return { subject: `Prochain prélèvement le ${longDate(booking.installmentDueDate || booking.startDate)} — ${title}`, body: `Le ${longDate(booking.installmentDueDate || booking.startDate)}, ${simulated ? 'un paiement simulé' : 'nous prélèverons'} ${euros(booking.totalPrice)} ${simulated ? 'sera enregistré' : `sur ${card}`} pour votre prochain séjour.\n\n${stayLine}\n\nVous n’avez rien à faire. Si votre carte a changé ou expire d’ici là, vous pouvez payer ce séjour à l’avance depuis votre espace locataire.\nRéférence : ${booking.id}` };
  }
  if (job.kind === 'INSTALLMENT_FAILED') {
    const deadline = installmentDeadline(booking);
    const retry = Date.parse(nextInstallmentAttempt(new Date(job.occurredAt)));
    return { subject: `Action requise : le paiement de votre séjour n’a pas abouti — ${title}`, body: `Le prélèvement de ${euros(booking.totalPrice)} pour votre ${position} n’a pas abouti.${booking.installmentLastError ? `\nMotif : ${booking.installmentLastError}` : ''}\n\n${stayLine}\n\nPayez ce séjour avant le ${deadlineText(deadline)} depuis votre espace locataire. ${retry < deadline ? `Une nouvelle tentative automatique aura lieu le ${deadlineText(retry)}. ` : ''}Sans paiement à cette date, ce séjour sera annulé et ses dates libérées. Vos autres séjours ne sont pas concernés.\nRéférence : ${booking.id}` };
  }
  return { subject: `Séjour annulé faute de paiement — ${title}`, body: `Le paiement de votre ${position} n’a pas pu être réalisé dans le délai prévu. Ce séjour est annulé et ses dates ont été libérées. Aucun montant n’a été prélevé pour ce séjour.\n\n${stayLine}\n\nVos autres séjours de la série sont maintenus. Pour réserver à nouveau ces dates, lancez une nouvelle recherche.\nRéférence : ${booking.id}` };
}

/** Variables of the recurring models in Resend (12 to 15), aligned with seriesMailContent. */
export function seriesMailValues(job: TenantMailJob, booking: Booking, title: string, context?: SeriesMailContext): Record<string, string> {
  const position = `séjour ${(booking.seriesIndex ?? 0) + 1}${booking.seriesCount ? ` sur ${booking.seriesCount}` : ''}`;
  const card = context?.series.cardLast4 ? `votre carte ${context.series.cardBrand ? `${context.series.cardBrand.toUpperCase()} ` : ''}se terminant par ${context.series.cardLast4}` : 'la carte utilisée pour votre premier séjour';
  const simulated = context?.series.paymentProvider === 'SIMULATION' || booking.paymentProvider === 'SIMULATION';
  const due = longDate(booking.installmentDueDate || booking.startDate);
  const values: Record<string, string> = { LOGEMENT: title, CHAMBRE: booking.roomName || 'Votre logement', DATE_ARRIVEE: longDate(booking.startDate), DATE_DEPART: longDate(booking.endDate), MONTANT_TOTAL: euros(booking.totalPrice), POSITION_SEJOUR: position };
  if (job.kind === 'SERIES_CONFIRMED') {
    const stays = [...(context?.stays || [booking])].filter(stay => stay.status !== 'CANCELLED').sort((a, b) => a.startDate.localeCompare(b.startDate));
    Object.assign(values, {
      NOMBRE_SEJOURS: String(stays.length),
      ECHEANCIER: stays.map(stay => `• Séjour ${(stay.seriesIndex ?? 0) + 1} · du ${longDate(stay.startDate)} au ${longDate(stay.endDate)} · ${euros(stay.totalPrice)} · ${stay.paymentStatus === 'PAID' ? 'payé' : `prélevé le ${longDate(stay.installmentDueDate || stay.startDate)}`}`).join('\n'),
      MONTANT_TOTAL: euros(stays.reduce((sum, stay) => sum + stay.totalPrice, 0)),
      INFORMATION_PRELEVEMENT: simulated ? 'Mode test : les séjours suivants seront simulés automatiquement, sans débit réel.' : `Les séjours suivants seront prélevés automatiquement sur ${card}, un mois avant chaque arrivée.`,
    });
  }
  if (job.kind === 'INSTALLMENT_UPCOMING') Object.assign(values, {
    DATE_PRELEVEMENT: due,
    INFORMATION_PRELEVEMENT: simulated ? `Le ${due}, un paiement simulé de ${euros(booking.totalPrice)} sera enregistré pour votre ${position}.` : `Le ${due}, nous prélèverons ${euros(booking.totalPrice)} sur ${card} pour votre ${position}.`,
  });
  if (job.kind === 'INSTALLMENT_FAILED') {
    const deadline = installmentDeadline(booking);
    const retry = Date.parse(nextInstallmentAttempt(new Date(job.occurredAt)));
    Object.assign(values, { MOTIF_ECHEC: booking.installmentLastError || 'Le prélèvement n’a pas abouti.', DATE_LIMITE: deadlineText(deadline), INFORMATION_RELANCE: retry < deadline ? `Une nouvelle tentative automatique aura lieu le ${deadlineText(retry)}.` : '' });
  }
  return values;
}
