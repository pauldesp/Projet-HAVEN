import type { Booking } from '../types';
import { arrivalInstant, confirmationEmail, escapeEmailHtml, type ReservationConfirmation } from './reservationFulfillment';

export type ReservationMailKind = 'CONFIRMATION' | 'ARRIVAL' | 'CHECKIN' | 'DEPARTURE_REMINDER' | 'CHECKOUT';
export interface ReservationMailJob {
  bookingId: string; kind: ReservationMailKind; status: string; attempts: number;
  nextAttemptAt?: string; reportId?: string; occurredAt?: string; firstSendAttemptAt?: string;
}
export function reservationMailJob(bookingId: string, kind: ReservationMailKind, at: string, reportId?: string): ReservationMailJob {
  return { bookingId, kind, status: 'PENDING', attempts: 0, nextAttemptAt: at, ...(reportId ? { reportId, occurredAt: at } : {}) };
}
// The day before departure at 10:00 in the property's timezone, including DST changes.
export function departureReminderDueAt(data: ReservationConfirmation) {
  const previous = new Date(`${data.endDate.slice(0, 10)}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return new Date(Math.max(Date.parse(data.paidAt), arrivalInstant(previous.toISOString().slice(0, 10), '10:00', data.timeZone).getTime())).toISOString();
}
export function initialReservationMailJobs(data: ReservationConfirmation) {
  return [reservationMailJob(data.bookingId, 'CONFIRMATION', data.paidAt), reservationMailJob(data.bookingId, 'ARRIVAL', data.instructionsDueAt), reservationMailJob(data.bookingId, 'DEPARTURE_REMINDER', departureReminderDueAt(data))];
}
export function reservationEmailConfiguration(env: Record<string, string | undefined>) {
  const start = env.RESERVATION_EMAIL_START_AT?.trim() || '';
  return { enabled: env.RESERVATION_EMAIL_ENABLED === 'true' && Number.isFinite(Date.parse(start)), startAt: start };
}
// Resend's demo sender can deliver only to the account owner's test address.
// Do not redirect another tenant's mail or private instructions to that address.
export function canSendReservationRecipient(from: string, recipient: string, testRecipient?: string) {
  if (!/@resend\.dev>?\s*$/i.test(from.trim())) return true;
  return Boolean(testRecipient?.trim()) && recipient.trim().toLowerCase() === testRecipient!.trim().toLowerCase();
}
export function reservationMailDisposition(job: ReservationMailJob, booking: Booking | undefined, receipt: ReservationConfirmation | undefined, startAt: string, now = Date.now()): 'SEND' | 'CANCELLED' | 'EXPIRED' | 'WAIT' | 'REVIEW_REQUIRED' {
  if (!booking || booking.paymentStatus !== 'PAID' || !['CONFIRMED', 'COMPLETED'].includes(booking.status)) return 'CANCELLED';
  // Explicit cutover: activating a provider never flushes old test reservations.
  if (!receipt || !Number.isFinite(Date.parse(receipt.paidAt)) || Date.parse(receipt.paidAt) < Date.parse(startAt)) return 'CANCELLED';
  if (job.firstSendAttemptAt && now - Date.parse(job.firstSendAttemptAt) >= 20 * 3600_000) return 'REVIEW_REQUIRED';
  const departure = arrivalInstant(receipt.endDate, receipt.checkOutTime, receipt.timeZone).getTime();
  const arrival = arrivalInstant(receipt.startDate, receipt.checkInTime, receipt.timeZone).getTime();
  if (job.kind === 'CHECKIN' || job.kind === 'CHECKOUT') {
    if (!job.reportId || job.reportId !== (job.kind === 'CHECKIN' ? booking.checkInReportId : booking.checkOutReportId)) return 'CANCELLED';
    return job.occurredAt && now - Date.parse(job.occurredAt) <= 24 * 3600_000 ? 'SEND' : 'EXPIRED';
  }
  if (booking.status === 'COMPLETED' || booking.checkOutReportId || now >= departure) return 'EXPIRED';
  if (job.kind === 'ARRIVAL') {
    if (booking.checkInReportId) return 'EXPIRED';
    return now < Date.parse(receipt.instructionsDueAt) ? 'WAIT' : 'SEND';
  }
  if (job.kind === 'CONFIRMATION') return now < arrival ? 'SEND' : 'EXPIRED';
  if (job.kind === 'DEPARTURE_REMINDER') return now < Date.parse(departureReminderDueAt(receipt)) ? 'WAIT' : 'SEND';
  return 'CANCELLED';
}
export function reservationLifecycleEmail(kind: ReservationMailKind, data: ReservationConfirmation, options: { instructions?: string; occurredAt?: string; appOrigin?: string } = {}) {
  const date = (value: string) => value.slice(0, 10).split('-').reverse().join('/');
  let subject: string;
  let body: string;
  if (kind === 'CONFIRMATION' || kind === 'ARRIVAL') {
    const original = confirmationEmail(data, kind === 'ARRIVAL' ? options.instructions || 'Les consignes d’accès ne sont pas encore renseignées. Contactez le propriétaire depuis la messagerie de votre séjour pour organiser la remise des clés.' : undefined);
    // Keep the existing text and payment attachment contract; apply a shared Haven layout.
    return withLayout(original.subject, original.text, data, options.appOrigin);
  }
  const location = `${data.listingTitle}${data.roomName ? ` — ${data.roomName}` : ''}`;
  const at = options.occurredAt ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: data.timeZone }).format(new Date(options.occurredAt)) : '';
  if (kind === 'CHECKIN') {
    subject = `Votre entrée est enregistrée — ${data.listingTitle}`;
    body = `Votre état des lieux d’entrée a été enregistré${at ? ` le ${at}` : ''}. Retrouvez le document, vos observations et vos photos dans Mes documents.\n\n${location}\nSéjour du ${date(data.startDate)} au ${date(data.endDate)}.\n\nPour un problème dans le logement, contactez le propriétaire. Vous pouvez transmettre un signalement à Haven depuis votre séjour si une intervention de notre équipe est nécessaire.`;
  } else if (kind === 'DEPARTURE_REMINDER') {
    subject = `Préparez votre départ du ${date(data.endDate)} — ${data.listingTitle}`;
    body = `Votre départ de ${location} est prévu le ${date(data.endDate)}, avant ${data.checkOutTime}.\n\nAvant de partir :\n• Retirez vos affaires personnelles.\n• Laissez la chambre, les sanitaires et les espaces communs propres et rangés.\n• Signalez toute dégradation dans l’état des lieux de sortie et ajoutez les photos demandées.\n• Réalisez l’état des lieux de sortie depuis Mes séjours, puis déposez les clés selon les modalités convenues avec le propriétaire. Ajoutez la preuve de dépôt demandée pour terminer votre départ.\n\nL’état des lieux de sortie est disponible le jour du départ. Si vous quittez le logement plus tôt, utilisez l’option de départ anticipé.\nEn cas de doute sur la remise des clés, contactez le propriétaire depuis la messagerie.`;
  } else {
    subject = `Votre départ est enregistré — ${data.listingTitle}`;
    body = `Votre état des lieux de sortie et votre déclaration de dépôt des clés ont été enregistrés${at ? ` le ${at}` : ''}. Votre séjour est terminé.\n\n${location}\nRetrouvez votre état des lieux dans Mes documents. Cet enregistrement ne remplace pas l’examen des constats par le propriétaire.\n\nMerci pour votre séjour avec Haven. Vous pouvez maintenant laisser votre avis depuis votre espace locataire.`;
  }
  const text = `${data.isTest ? 'TEST — aucun paiement réel n’a été effectué.\n\n' : ''}Bonjour ${data.tenantName},\n\n${body}\n\nRéférence : ${data.bookingId}\nL’équipe Haven`;
  return withLayout(`${data.isTest ? '[TEST] ' : ''}${subject}`, text, data, options.appOrigin);
}
export function withLayout(subject: string, text: string, data: Pick<ReservationConfirmation, 'listingTitle'>, origin?: string, buttonLabel = 'Mes séjours') {
  let dashboard = '';
  try { const url = new URL(origin || ''); if (['https:', 'http:'].includes(url.protocol)) dashboard = `${url.origin}/#/dashboard`; } catch { /* No guessed public URL in transactional mail. */ }
  return { subject, text: text + (dashboard ? `\n\n${buttonLabel} : ${dashboard}` : ''), html: `<html lang="fr"><body style="margin:0;background:#f3f0ea;font-family:Arial,sans-serif;color:#202b3d"><table role="presentation" style="width:100%;max-width:620px;margin:24px auto;background:#fffefa;border-top:4px solid #913c48;border-collapse:collapse"><tr><td style="padding:32px 36px;background:#f6f2ec"><span style="font-family:Georgia,serif;font-size:36px;color:#913c48">haven</span><h1 style="font-family:Georgia,serif;font-size:25px;font-weight:400;line-height:1.3">${escapeEmailHtml(subject)}</h1></td></tr><tr><td style="padding:30px 36px;white-space:pre-line;font-size:14px;line-height:1.8">${escapeEmailHtml(text)}</td></tr>${dashboard ? `<tr><td style="padding:0 36px 32px"><a href="${escapeEmailHtml(dashboard)}" style="display:inline-block;padding:13px 22px;background:#202b3d;color:white;text-decoration:none;border-radius:6px">${escapeEmailHtml(buttonLabel)}</a></td></tr>` : ''}<tr><td style="padding:18px 36px;border-top:1px solid #e7e2dc;color:#7b7b79;font-size:11px">Haven · ${escapeEmailHtml(data.listingTitle)}</td></tr></table></body></html>` };
}
