import { OWNER_CLEANING_RULE, TENANT_CLEANING_RULE } from './cleaningPolicy';
import type { Booking, Listing } from '../types';

export const HAVEN_HOUSE_RULES = [
  OWNER_CLEANING_RULE,
  TENANT_CLEANING_RULE,
  'Respectez le calme du logement, le voisinage et les autres occupants.',
  'Laissez les espaces communs propres après utilisation et prenez soin des équipements.',
  'Respectez les espaces privés et les effets personnels des autres occupants.',
  'Signalez rapidement au propriétaire tout incident ou dégât dans le logement.',
  'Respectez les horaires d’arrivée et de départ indiqués dans votre réservation.',
];

// Convert the property's wall clock into UTC, independently of the server timezone.
export function arrivalInstant(date: string, time = '15:00', timeZone = 'Europe/Paris') {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wall;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    instant += wall - shown;
  }
  if (!Number.isFinite(instant)) throw new Error('Date d’arrivée invalide.');
  return new Date(instant);
}
export function instructionsDueAt(booking: Pick<Booking, 'startDate' | 'checkInTime' | 'paidAt'>, timeZone = 'Europe/Paris') {
  return new Date(Math.max(new Date(booking.paidAt!).getTime(), arrivalInstant(booking.startDate, booking.checkInTime || '15:00', timeZone).getTime() - 72 * 3600_000)).toISOString();
}
export interface ReservationConfirmation {
  id: string; bookingId: string; tenantId: string; ownerId: string;
  tenantName: string; email: string; listingTitle: string; roomName: string;
  address: string; startDate: string; endDate: string; checkInTime: string; checkOutTime: string;
  timeZone: string; paidAt: string; amountCents: number; basePrice: number; cleaningFee: number; platformFee: number;
  provider: string; isTest: boolean; paymentReference: string; rules: string[]; instructionsDueAt: string;
}
export function createReservationConfirmation(booking: Booking, listing: Partial<Listing>, tenant: { firstName?: string; lastName?: string; email?: string }, timeZone = 'Europe/Paris'): ReservationConfirmation {
  return {
    id: `receipt-${booking.id}`, bookingId: booking.id, tenantId: booking.tenantId, ownerId: booking.ownerId,
    tenantName: [tenant.firstName, tenant.lastName].filter(Boolean).join(' ') || 'Locataire', email: tenant.email || '',
    listingTitle: booking.listingTitle || listing.title || 'Logement Haven', roomName: booking.roomName || '',
    address: [listing.address, [listing.postalCode, listing.city].filter(Boolean).join(' '), listing.country].filter(Boolean).join(', '), startDate: booking.startDate, endDate: booking.endDate,
    checkInTime: booking.checkInTime || listing.checkInTime || '15:00', checkOutTime: booking.checkOutTime || listing.checkOutTime || '11:00',
    timeZone, paidAt: booking.paidAt!, amountCents: Math.round(booking.totalPrice * 100), basePrice: booking.basePrice, cleaningFee: booking.cleaningFee, platformFee: booking.platformFee,
    provider: booking.paymentProvider!, isTest: booking.paymentIsTest === true, paymentReference: booking.checkoutSessionId || booking.stripeSessionId || '',
    rules: [...HAVEN_HOUSE_RULES], instructionsDueAt: instructionsDueAt({ ...booking, checkInTime: booking.checkInTime || listing.checkInTime || '15:00' }, timeZone),
  };
}
export const escapeEmailHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function confirmationEmail(data: ReservationConfirmation, instructions?: string) {
  const date = (value: string) => value.slice(0, 10).split('-').reverse().join('/');
  const test = data.isTest ? 'TEST — aucun paiement réel n’a été effectué.\n\n' : '';
  const text = `${test}Bonjour ${data.tenantName},\n\n${instructions ? 'Voici les informations pour votre entrée dans le logement.' : 'Votre réservation est confirmée. Votre justificatif de paiement est joint à cet e-mail et disponible dans Mes séjours.'}\n\n${data.listingTitle}${data.roomName ? ` — ${data.roomName}` : ''}\nAdresse : ${data.address || 'Adresse à préciser par le propriétaire'}\nDu ${date(data.startDate)} à ${data.checkInTime} au ${date(data.endDate)} à ${data.checkOutTime}.\nRéférence : ${data.bookingId}\n\nRègles communes Haven :\n${data.rules.map(rule => `• ${rule}`).join('\n')}\n\n${instructions ? `Consignes d’entrée :\n${instructions}` : 'Vous recevrez toutes les informations d’entrée dans le logement 72 heures avant votre arrivée. Si vous réservez moins de 72 heures avant l’arrivée, elles seront envoyées dès la confirmation.'}\n\nRetrouvez votre réservation dans Mes séjours.\nL’équipe Haven`;
  return { subject: `${data.isTest ? '[TEST] ' : ''}${instructions ? 'Vos informations d’entrée' : 'Réservation confirmée'} — ${data.listingTitle}`, text, html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#1e293b"><h1>HAVEN</h1><div style="white-space:pre-line;line-height:1.7">${escapeEmailHtml(text)}</div></div>` };
}

export function canReleaseArrivalInstructions(booking: Pick<Booking, 'status' | 'paymentStatus'>, dueAt: string, now = Date.now()) {
  return booking.status === 'CONFIRMED' && booking.paymentStatus === 'PAID' && Number.isFinite(Date.parse(dueAt)) && now >= Date.parse(dueAt);
}
