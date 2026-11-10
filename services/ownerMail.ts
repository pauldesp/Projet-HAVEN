import type { Booking, Incident, OwnerPayout } from '../types';
import { withLayout } from './reservationMail';
import { ownerShare } from './money';

export type OwnerMailKind = 'OWNER_BOOKING' | 'OWNER_SERIES' | 'OWNER_CANCELLED' | 'OWNER_INCIDENT' | 'OWNER_PAYOUT';
export const OWNER_MAIL_KINDS: readonly OwnerMailKind[] = ['OWNER_BOOKING', 'OWNER_SERIES', 'OWNER_CANCELLED', 'OWNER_INCIDENT', 'OWNER_PAYOUT'];
export const isOwnerMailKind = (value: unknown): value is OwnerMailKind => OWNER_MAIL_KINDS.includes(value as OwnerMailKind);

export interface OwnerMailJob {
  kind: OwnerMailKind; userId: string; occurredAt: string; status: 'PENDING'; attempts: number; nextAttemptAt: string;
  bookingId?: string; seriesId?: string; incidentId?: string; payoutId?: string;
}
/** Everything the mail needs, read by the server just before sending. */
export interface OwnerMailData {
  owner?: { firstName?: string; email?: string };
  tenant?: { firstName?: string; lastName?: string };
  booking?: Booking;
  stays?: Booking[];
  incident?: Incident;
  payout?: OwnerPayout;
  listingTitle?: string;
}

export const ownerMailJob = (kind: OwnerMailKind, ownerId: string, at: string, refs: Omit<OwnerMailJob, 'kind' | 'userId' | 'occurredAt' | 'status' | 'attempts' | 'nextAttemptAt'>): OwnerMailJob =>
  ({ kind, userId: ownerId, occurredAt: at, status: 'PENDING', attempts: 0, nextAttemptAt: at, ...refs });

/** Outbox document id: one mail per event. */
export const ownerMailId = (job: OwnerMailJob) => `${job.bookingId || job.seriesId || job.incidentId || job.payoutId}-${job.kind}`;

export function ownerMailDisposition(job: OwnerMailJob, data: OwnerMailData, startAt: string, now = Date.now()): 'SEND' | 'CANCELLED' | 'EXPIRED' {
  const occurred = Date.parse(job.occurredAt);
  if (!Number.isFinite(occurred) || !Number.isFinite(Date.parse(startAt)) || occurred < Date.parse(startAt)) return 'CANCELLED';
  if (now - occurred >= 7 * 86400_000) return 'EXPIRED';
  if (!data.owner?.email) return 'CANCELLED';
  const booking = data.booking;
  if (job.kind === 'OWNER_PAYOUT') return data.payout?.ownerId === job.userId && data.payout.status === 'PAID' ? 'SEND' : 'CANCELLED';
  if (job.kind === 'OWNER_INCIDENT') return data.incident?.ownerId === job.userId ? 'SEND' : 'CANCELLED';
  if (!booking || booking.ownerId !== job.userId) return 'CANCELLED';
  if (job.kind === 'OWNER_CANCELLED') return booking.status === 'CANCELLED' ? 'SEND' : 'CANCELLED';
  return booking.paymentStatus === 'PAID' && ['CONFIRMED', 'COMPLETED'].includes(booking.status) ? 'SEND' : 'CANCELLED';
}

const longDate = (value: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
const instant = (value: string, timeZone = 'Europe/Paris') => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone }).format(new Date(value));
const euros = (value: number) => value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
/** First name and initial: owners do not need the tenant's full last name by e-mail. */
const tenantName = (data: OwnerMailData) => [data.tenant?.firstName || 'Votre locataire', data.tenant?.lastName ? `${data.tenant.lastName.charAt(0).toUpperCase()}.` : ''].filter(Boolean).join(' ');
const share = (booking: Booking) => ownerShare(booking) ?? booking.basePrice + booking.cleaningFee;
const priority = (value?: Incident['priority']) => value === 'HIGH' ? 'Urgente' : value === 'LOW' ? 'Basse' : 'Moyenne';

/** Template variables shared by the owner models in Resend (16 to 20). */
export function ownerMailValues(job: OwnerMailJob, data: OwnerMailData): Record<string, string> {
  const booking = data.booking;
  const title = booking?.listingTitle || data.listingTitle || 'Votre logement';
  const test = Boolean(booking?.paymentIsTest || booking?.paymentProvider === 'SIMULATION' || data.payout?.isTest);
  const values: Record<string, string> = {
    PRENOM_PROPRIETAIRE: data.owner?.firstName || 'à vous',
    MENTION_TEST: test ? 'TEST · Notification de démonstration, aucun paiement réel.' : '',
    REFERENCE_DOSSIER: job.kind === 'OWNER_PAYOUT' ? 'Virement Haven' : job.kind === 'OWNER_SERIES' ? `Série · ${job.seriesId}` : `Réservation · ${booking?.id || job.bookingId || ''}`,
    LOCATAIRE: tenantName(data),
  };
  if (booking) Object.assign(values, { LOGEMENT: title, CHAMBRE: booking.roomName || 'Votre logement', DATE_ARRIVEE: longDate(booking.startDate), DATE_DEPART: longDate(booking.endDate) });
  if (job.kind === 'OWNER_BOOKING' && booking) Object.assign(values, { MONTANT_PROPRIETAIRE: euros(share(booking)), HEURE_ARRIVEE: booking.checkInTime || '15:00', HEURE_DEPART: booking.checkOutTime || '11:00' });
  if (job.kind === 'OWNER_SERIES') {
    const stays = [...(data.stays || (booking ? [booking] : []))].filter(stay => stay.status !== 'CANCELLED').sort((a, b) => a.startDate.localeCompare(b.startDate));
    Object.assign(values, {
      NOMBRE_SEJOURS: String(stays.length),
      ECHEANCIER: stays.map(stay => `• Séjour ${(stay.seriesIndex ?? 0) + 1} · du ${longDate(stay.startDate)} au ${longDate(stay.endDate)} · votre part ${euros(share(stay))} · ${stay.paymentStatus === 'PAID' ? 'payé' : `paiement prévu le ${longDate(stay.installmentDueDate || stay.startDate)}`}`).join('\n'),
      MONTANT_PROPRIETAIRE: euros(stays.reduce((sum, stay) => sum + share(stay), 0)),
    });
  }
  if (job.kind === 'OWNER_CANCELLED' && booking) {
    const unpaid = Boolean(booking.unpaidCancelledAt) && !booking.cancellation;
    const cancellation = booking.cancellation;
    Object.assign(values, {
      DATE_ACTION: instant(cancellation?.cancelledAt || booking.unpaidCancelledAt || job.occurredAt, booking.timeZone),
      INITIATIVE_ANNULATION: unpaid ? 'faute de paiement du locataire' : cancellation?.cancelledBy === 'OWNER' ? 'à votre initiative' : 'à l’initiative du locataire',
      MOTIF_ANNULATION: unpaid ? 'Le paiement de ce séjour n’a pas été reçu dans le délai prévu.' : cancellation?.reason || 'Non précisé.',
      INFORMATION_VERSEMENT: unpaid || booking.paymentStatus !== 'PAID'
        ? 'Ce séjour n’avait pas encore été payé : aucun montant n’a été encaissé et aucun versement n’aura lieu.'
        : `Le locataire est remboursé à ${cancellation?.refundPercent ?? 0} % selon les conditions d’annulation. Aucun versement n’aura lieu pour ce séjour.`,
    });
  }
  if (job.kind === 'OWNER_INCIDENT' && data.incident) Object.assign(values, {
    DATE_ACTION: instant(data.incident.createdAt, booking?.timeZone), TITRE_SIGNALEMENT: data.incident.title, PRIORITE: priority(data.incident.priority),
    DESCRIPTION_SIGNALEMENT: data.incident.description || 'Aucune précision.',
  });
  if (job.kind === 'OWNER_PAYOUT' && data.payout) Object.assign(values, {
    MONTANT_VIREMENT: euros(data.payout.amountCents / 100), DATE_ACTION: instant(data.payout.paidAt || job.occurredAt), REFERENCE_VIREMENT: data.payout.providerPayoutId || data.payout.id,
  });
  return values;
}

/** Same content in the Haven layout, used when Resend templates are turned off. */
export function ownerNotificationEmail(job: OwnerMailJob, data: OwnerMailData, appOrigin?: string) {
  const values = ownerMailValues(job, data);
  const stay = values.LOGEMENT ? `${values.LOGEMENT}${data.booking?.roomName ? ` — ${values.CHAMBRE}` : ''}\nDu ${values.DATE_ARRIVEE} au ${values.DATE_DEPART}.` : '';
  const content: Record<OwnerMailKind, [string, string]> = {
    OWNER_BOOKING: [`Nouvelle réservation — ${values.LOGEMENT}`, `${values.LOCATAIRE} a réservé et payé un séjour dans votre logement.\n\n${stay}\n\nVotre part : ${values.MONTANT_PROPRIETAIRE} (hébergement et ménage, hors frais Haven), versée après l’arrivée du locataire.\nArrivée à partir de ${values.HEURE_ARRIVEE}, départ avant ${values.HEURE_DEPART}.\n\nVérifiez vos consignes d’accès : Haven les transmet au locataire 72 heures avant son arrivée.`],
    OWNER_SERIES: [`Réservation récurrente : ${values.NOMBRE_SEJOURS} séjours — ${values.LOGEMENT}`, `${values.LOCATAIRE} a réservé ${values.NOMBRE_SEJOURS} séjours dans votre logement. Le premier est payé ; les dates de tous les séjours sont bloquées.\n\n${values.ECHEANCIER}\n\nVotre part pour la série : ${values.MONTANT_PROPRIETAIRE}.\nChaque séjour suivant est payé par le locataire un mois avant son arrivée, et votre part vous est versée après son arrivée.`],
    OWNER_CANCELLED: [`Réservation annulée — ${values.LOGEMENT}`, `La réservation de ${values.LOCATAIRE} a été annulée le ${values.DATE_ACTION}, ${values.INITIATIVE_ANNULATION}.\n\n${stay}\n\nMotif : ${values.MOTIF_ANNULATION}\n${values.INFORMATION_VERSEMENT}\n\nCes dates sont de nouveau disponibles à la réservation.`],
    OWNER_INCIDENT: [`Signalement : ${values.TITRE_SIGNALEMENT} — ${values.LOGEMENT || data.listingTitle || 'votre logement'}`, `${values.LOCATAIRE} vous a signalé un problème le ${values.DATE_ACTION}.\n\n${stay}\n\n${values.TITRE_SIGNALEMENT} (priorité ${values.PRIORITE})\n${values.DESCRIPTION_SIGNALEMENT}\n\nPrenez-le en charge depuis votre espace propriétaire.`],
    OWNER_PAYOUT: [`Virement effectué : ${values.MONTANT_VIREMENT}`, `Un virement de ${values.MONTANT_VIREMENT} a été versé sur votre compte bancaire le ${values.DATE_ACTION}.\nRéférence Stripe : ${values.REFERENCE_VIREMENT}\n\nLe détail de vos virements est disponible dans l’onglet Finances de votre espace propriétaire.`],
  };
  const [subject, body] = content[job.kind];
  const test = values.MENTION_TEST ? 'TEST — notification de démonstration.\n\n' : '';
  return withLayout(`${test ? '[TEST] ' : ''}${subject}`, `${test}Bonjour ${values.PRENOM_PROPRIETAIRE},\n\n${body}\n\nL’équipe Haven`, { listingTitle: values.LOGEMENT || 'Votre espace propriétaire' }, appOrigin, 'Mon espace propriétaire', '/owner/dashboard');
}
