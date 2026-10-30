import type { Booking } from '../types';
import type { ReservationMailKind } from './reservationMail';
import type { TenantMailJob, TenantMailProfile } from './tenantMail';
import { escapeEmailHtml, type ReservationConfirmation } from './reservationFulfillment';

// IDs verified in the Haven Resend account. Content and subject live in Resend.
export const RESEND_TEMPLATE_IDS = {
  CONFIRMATION: 'b2c2500a-84a3-4bff-86ec-c3388ffe25b1',
  ARRIVAL: '574da750-cb95-4ae2-bb9b-7abf2de6cf93',
  CHECKIN: '1aed423d-aeaa-44e7-a077-d1b03fda42d0',
  DEPARTURE_REMINDER: '94f026e5-1fd7-4944-beb2-81e3565a08dc',
  CHECKOUT: 'bb11203b-d4aa-4efb-b997-93ecf79d6588',
  ACCOUNT_APPROVED: 'cc072e4e-0a95-4472-a7a0-5bad53444ae2',
  ACCOUNT_CORRECTION: '0ffc45ad-c5a9-43cc-9ae9-22f934e44471',
  CANCELLED: '21691692-ec7e-456d-aefc-6110a0024f47',
  REVIEW_INVITE: '6cdab46e-ebc3-437d-abec-596924d199f9',
  EMAIL_VERIFICATION: 'e0d3f410-4d3f-4d2d-8201-7a91dd1ee2e6',
  PASSWORD_RESET: 'e06fedbf-75ee-4eff-a6e8-013d244d01ac',
} as const;
export type HavenMailKind = keyof typeof RESEND_TEMPLATE_IDS;
export type AuthMailKind = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';
export interface ResendTemplate { template: { id: string; variables: Record<string, string> } }
export const resendTemplatesEnabled = (env: Record<string, string | undefined>) => env.RESEND_TEMPLATES_ENABLED === 'true';
const date = (value: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
const instant = (value: string, timeZone = 'Europe/Paris') => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone }).format(new Date(value));
const money = (value: number) => {
  if (!Number.isFinite(value)) throw new Error('Montant e-mail invalide.');
  return value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
};
export function mailDashboardLink(origin?: string, route = '/dashboard') {
  const url = new URL(origin || '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL Haven invalide pour les e-mails.');
  return `${url.origin}/#${route}`;
}
function template(kind: HavenMailKind, values: Record<string, string>): ResendTemplate {
  // All dynamic values are text, never raw HTML. Escape even with triple-brace templates.
  return { template: { id: RESEND_TEMPLATE_IDS[kind], variables: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, escapeEmailHtml(value)])) } };
}
const common = (name: string, reference: string, link: string, test: boolean) => ({
  PRENOM_LOCATAIRE: name || 'à vous', REFERENCE_DOSSIER: reference, LIEN_ACTION: link,
  MENTION_TEST: test ? 'TEST · Notification de démonstration, aucun paiement réel.' : '',
});
const stay = (data: Pick<ReservationConfirmation, 'listingTitle' | 'roomName' | 'startDate' | 'endDate'>) => ({
  LOGEMENT: data.listingTitle, CHAMBRE: data.roomName || 'Votre logement', DATE_ARRIVEE: date(data.startDate), DATE_DEPART: date(data.endDate),
});
export function reservationResendTemplate(kind: ReservationMailKind, data: ReservationConfirmation, options: { instructions?: string; occurredAt?: string; appOrigin?: string } = {}) {
  const values: Record<string, string> = { ...common(data.tenantName, `Réservation · ${data.bookingId}`, mailDashboardLink(options.appOrigin), data.isTest), ...stay(data) };
  if (kind === 'CONFIRMATION') Object.assign(values, {
    ADRESSE: data.address || 'Adresse à préciser par le propriétaire', HEURE_ARRIVEE: data.checkInTime, HEURE_DEPART: data.checkOutTime,
    MONTANT_HEBERGEMENT: money(data.basePrice), FRAIS_MENAGE: money(data.cleaningFee), FRAIS_SERVICE: money(data.platformFee),
    MONTANT_TOTAL: money(data.amountCents / 100), REFERENCE_PAIEMENT: data.paymentReference || 'Disponible dans votre réservation',
  });
  if (kind === 'ARRIVAL') Object.assign(values, {
    ADRESSE: data.address || 'Adresse à préciser par le propriétaire', HEURE_ARRIVEE: data.checkInTime,
    CONSIGNES_ACCES: options.instructions?.trim() || 'Les consignes d’accès ne sont pas encore renseignées. Contactez le propriétaire depuis la messagerie de votre séjour pour organiser la remise des clés.',
  });
  if (kind === 'DEPARTURE_REMINDER') values.HEURE_DEPART = data.checkOutTime;
  if (kind === 'CHECKIN' || kind === 'CHECKOUT') {
    if (!options.occurredAt) throw new Error('Horodatage de l’état des lieux manquant.');
    values.DATE_ACTION = instant(options.occurredAt, data.timeZone);
  }
  return template(kind, values);
}
export function tenantResendTemplate(job: TenantMailJob, profile: TenantMailProfile, booking?: Booking, listingTitle?: string, appOrigin?: string) {
  const test = Boolean(job.exceptional || booking?.paymentIsTest || booking?.paymentProvider === 'SIMULATION');
  const values: Record<string, string> = common(profile.firstName || 'à vous', job.kind.startsWith('ACCOUNT_') ? 'Votre compte Haven' : `Réservation · ${booking?.id}`, mailDashboardLink(appOrigin, job.kind === 'ACCOUNT_APPROVED' ? '/search' : '/dashboard'), test);
  if (job.kind === 'ACCOUNT_APPROVED') values.MESSAGE_VALIDATION = job.exceptional
    ? 'Une validation exceptionnelle de test a été accordée à votre compte. Vous pouvez poursuivre vos essais de réservation sur Haven.'
    : 'Votre dossier a été validé par Haven. Vous pouvez maintenant réserver votre prochain séjour.';
  else if (job.kind === 'ACCOUNT_CORRECTION') values.MOTIF_CORRECTION = profile.rejectionReason || 'Consultez les indications dans votre espace personnel.';
  else {
    if (!booking) throw new Error('Réservation manquante pour l’e-mail.');
    Object.assign(values, stay({ ...booking, listingTitle: booking.listingTitle || listingTitle || 'Votre séjour Haven', roomName: booking.roomName || '' }));
    if (job.kind === 'CANCELLED') {
      const cancellation = booking.cancellation;
      if (!cancellation) throw new Error('Annulation manquante pour l’e-mail.');
      Object.assign(values, { DATE_ACTION: instant(cancellation.cancelledAt, booking.timeZone), INITIATIVE_ANNULATION: cancellation.cancelledBy === 'OWNER' ? 'à l’initiative du propriétaire' : 'à votre demande', MOTIF_ANNULATION: cancellation.reason,
        INFORMATION_REMBOURSEMENT: cancellation.refundStatus === 'SIMULATED' ? `Remboursement simulé : ${money(cancellation.refundAmount)}. Aucun remboursement bancaire réel n’a été effectué.`
          : cancellation.refundAmount > 0 ? `Remboursement enregistré : ${money(cancellation.refundAmount)}. Le délai d’apparition sur votre compte dépend du prestataire de paiement et de votre banque.` : 'Aucun remboursement n’est enregistré pour cette annulation.' });
    } else {
      if (!booking.completedAt) throw new Error('Date de départ effectif manquante.');
      values.DATE_LIMITE_AVIS = instant(new Date(Date.parse(booking.completedAt) + 7 * 86400_000).toISOString(), booking.timeZone);
    }
  }
  return template(job.kind, values);
}
export function authResendTemplate(kind: AuthMailKind, name: string, actionLink: string, authDomain: string) {
  const url = new URL(actionLink);
  const mode = kind === 'EMAIL_VERIFICATION' ? 'verifyEmail' : 'resetPassword';
  if (url.protocol !== 'https:' || url.hostname !== authDomain || url.username || url.password || !(kind === 'EMAIL_VERIFICATION' ? [mode, 'verifyAndChangeEmail'] : [mode]).includes(url.searchParams.get('mode') || '') || !url.searchParams.get('oobCode')) throw new Error('Lien Firebase invalide.');
  url.searchParams.set('lang', 'fr');
  return template(kind, { ...common(name, 'Sécurité de votre compte Haven', url.toString(), false) });
}

export function selectMailContent(legacy: { subject: string; text: string; html: string }, selected: ResendTemplate | undefined) {
  // Frozen legacy payloads bypass this function on retries. Never mix html/text with template.
  return selected || legacy;
}
