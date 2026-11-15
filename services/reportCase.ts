import type { Booking, DamageClaim, InventoryReport, Report } from '../types';
import { DAMAGE_DEPOSIT_POLICY, damageClaimDeadline } from './damageDeposit';
import { CHECKOUT_COMMON_TASKS, CHECKOUT_ROOM_TASKS } from './cleaningPolicy';

/** Everything the Haven team needs to settle a report without hunting through tabs. */
export interface CaseMember { id: string; firstName: string; lastName: string; email: string; phone: string; role: string; status: string }
export interface CaseStay { booking: Booking; tenant: CaseMember | null; checkIn: InventoryReport | null; checkOut: InventoryReport | null }
export interface CaseSettlement { state: string; amountCents: number; adminHold: boolean; holdReason?: string }
export interface ReportCase {
  /** Null when the file is opened from a booking rather than a report. */
  report: Report | null;
  reporter: CaseMember | null;
  owner: CaseMember | null;
  listing: { id: string; title: string; city: string; address: string; status: string; roomName: string } | null;
  stay: CaseStay | null;
  settlement: CaseSettlement | null;
  previousStay: (CaseStay & { damageClaim: DamageClaim | null }) | null;
  related: { id: string; kind: 'REPORT' | 'INCIDENT'; title: string; status: string; createdAt: string }[];
  guidance: CaseGuidance[];
}
export interface CaseGuidance { tone: 'INFO' | 'WARNING' | 'ACTION'; text: string }

const paidStay = (booking: Booking) => booking.paymentStatus === 'PAID' && ['CONFIRMED', 'COMPLETED'].includes(booking.status);
const day = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/** The paid stay in the same room that ended last, on or before the arrival of the reported stay. */
export function pickPreviousStay(roomBookings: Booking[], current: Pick<Booking, 'id' | 'roomId' | 'startDate'>) {
  return roomBookings
    .filter(item => item.id !== current.id && item.roomId === current.roomId && paidStay(item) && item.endDate.slice(0, 10) <= current.startDate.slice(0, 10))
    .sort((a, b) => b.endDate.localeCompare(a.endDate) || b.startDate.localeCompare(a.startDate))[0] || null;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to.slice(0, 10)}T12:00:00Z`) - Date.parse(`${from.slice(0, 10)}T12:00:00Z`)) / 86400_000);
function checkoutDetails(report: InventoryReport | null) {
  if (!report) return null;
  try { return JSON.parse(report.comments) || {}; } catch { return {}; }
}

/** Reading of the file: who was responsible for what, and which tools can settle it. */
export function caseGuidance(input: { report: Report | null; stay: CaseStay | null; previousStay: ReportCase['previousStay']; settlement: CaseSettlement | null; today: string }): CaseGuidance[] {
  const { report, stay, previousStay, settlement, today } = input;
  const guidance: CaseGuidance[] = [];
  const text = report ? `${report.supportCategory || ''} ${report.description || ''}`.toLocaleLowerCase('fr') : '';
  const aboutCommons = text.includes('espaces communs') || text.includes('cuisine') || text.includes('salle de bain');
  const aboutCleaning = text.includes('ménage') || text.includes('propre') || text.includes('sale');

  if (stay && !previousStay) {
    guidance.push({ tone: 'INFO', text: 'Aucun séjour Haven avant celui-ci dans cette chambre : la préparation de la chambre relevait du propriétaire.' });
  }
  if (stay && previousStay) {
    const gap = daysBetween(previousStay.booking.endDate, stay.booking.startDate);
    guidance.push({ tone: 'INFO', text: gap === 0
      ? `Le locataire précédent est parti le jour même de l’arrivée (${day(stay.booking.startDate)}) : le propriétaire n’avait pas de journée pour vérifier la chambre.`
      : `${gap} jour${gap > 1 ? 's' : ''} entre le départ du locataire précédent (${day(previousStay.booking.endDate)}) et cette arrivée : le propriétaire pouvait vérifier la chambre entre les deux.` });
    const details = checkoutDetails(previousStay.checkOut);
    if (!previousStay.checkOut) {
      guidance.push({ tone: 'WARNING', text: 'Le locataire précédent n’a pas fait d’état des lieux de sortie : son engagement de ménage n’est pas prouvé.' });
    } else {
      const checklist = details?.checklist || {};
      const tasks = Object.keys(aboutCommons && !text.includes('chambre') ? CHECKOUT_COMMON_TASKS : { ...CHECKOUT_ROOM_TASKS, ...CHECKOUT_COMMON_TASKS });
      const certified = tasks.every(key => checklist[key] === true);
      guidance.push({ tone: certified ? 'WARNING' : 'INFO', text: certified
        ? 'À son départ, le locataire précédent a certifié le ménage et joint des photos : comparez-les avec celles du signalement. S’il y a contradiction, sa responsabilité est engagée.'
        : 'L’état des lieux de sortie du locataire précédent est incomplet sur le ménage : sa responsabilité est probable.' });
      if (checklist.damage_reported === true) guidance.push({ tone: 'INFO', text: 'Le locataire précédent avait lui-même signalé une dégradation à son départ.' });
    }
    const claim = previousStay.damageClaim;
    if (claim) guidance.push({ tone: 'INFO', text: `Une demande sur la caution du locataire précédent existe déjà (${claim.status === 'SUBMITTED' ? 'en examen' : 'traitée'}) : voir Finances › Cautions.` });
    else if (!previousStay.booking.depositConsent) guidance.push({ tone: 'INFO', text: 'Le séjour précédent a été réservé avant la caution : aucun prélèvement possible, seulement une solution amiable.' });
    else if (today <= damageClaimDeadline(previousStay.booking)) guidance.push({ tone: 'ACTION', text: `Si le locataire précédent est en cause, Haven peut ouvrir une demande sur sa caution (jusqu’à ${DAMAGE_DEPOSIT_POLICY.amountCents / 100} €) jusqu’au ${day(damageClaimDeadline(previousStay.booking))} inclus.` });
    else guidance.push({ tone: 'INFO', text: `Le délai de la caution du locataire précédent est passé (${day(damageClaimDeadline(previousStay.booking))}).` });
  }
  if (aboutCleaning && aboutCommons) guidance.push({ tone: 'INFO', text: 'Les espaces communs relèvent aussi du ménage hebdomadaire organisé par le propriétaire (forfait ménage) : vérifiez sa date de passage.' });
  if (settlement) {
    if (['TRANSFERRED', 'REVERSED', 'PARTIALLY_REVERSED'].includes(settlement.state)) guidance.push({ tone: 'INFO', text: 'La part du propriétaire pour ce séjour est déjà partie : un geste envers le locataire se fait par un remboursement pris sur la commission Haven (Finances › Paiements).' });
    else if (settlement.adminHold) guidance.push({ tone: 'INFO', text: `Le versement au propriétaire est bloqué (${settlement.holdReason || 'sans motif'}).` });
    else guidance.push({ tone: 'ACTION', text: 'Le versement au propriétaire pour ce séjour n’est pas encore parti : vous pouvez le bloquer le temps de l’examen.' });
  }
  return guidance;
}
