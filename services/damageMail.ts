import type { DamageClaim } from '../types';
import { formatEuros } from './money';
import { withLayout } from './reservationMail';
import { DAMAGE_DEPOSIT_POLICY, damageResponseDeadline } from './damageDeposit';

/** E-mails of the deposit: the tenant is told of a claim, both parties of the decision, the team of a new claim. */
export type DamageMailEvent = 'CLAIM_OPENED' | 'DECISION_TENANT' | 'DECISION_OWNER' | 'TEAM_NEW_CLAIM';
export interface DamageMailJob {
  kind: 'DAMAGE_MAIL'; event: DamageMailEvent; claimId: string; occurredAt: string;
  status: 'PENDING'; attempts: number; nextAttemptAt: string;
}
export const isDamageMailJob = (job: { kind?: unknown }) => job.kind === 'DAMAGE_MAIL';

export const damageMailJob = (event: DamageMailEvent, claimId: string, at: string): DamageMailJob =>
  ({ kind: 'DAMAGE_MAIL', event, claimId, occurredAt: at, status: 'PENDING', attempts: 0, nextAttemptAt: at });
/** Outbox document id: one message per event and claim, so a retried action never sends twice. */
export const damageMailId = (event: DamageMailEvent, claimId: string) => `${claimId}-DAMAGE-${event}`;

/** A message about a decision is sent only if that decision still stands; a notice of claim only while it is open. */
export function damageMailDisposition(job: Pick<DamageMailJob, 'event' | 'occurredAt'>, claim: DamageClaim | undefined, now = Date.now()): 'SEND' | 'CANCELLED' | 'EXPIRED' {
  if (!claim) return 'CANCELLED';
  if (now - Date.parse(job.occurredAt) >= 7 * 86400_000) return 'EXPIRED';
  if (job.event === 'CLAIM_OPENED' || job.event === 'TEAM_NEW_CLAIM') return claim.status === 'SUBMITTED' ? 'SEND' : 'CANCELLED';
  return claim.decision && claim.decision.at === job.occurredAt ? 'SEND' : 'CANCELLED';
}

const day = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const moment = (value: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(value));
const euros = (cents: number) => formatEuros(cents / 100);

export function damageMailContent(event: DamageMailEvent, claim: DamageClaim, recipientFirstName: string, appOrigin?: string) {
  const hello = `Bonjour ${recipientFirstName || ''},`.replace(' ,', ',');
  const stay = `votre séjour à « ${claim.listingTitle} », terminé le ${day(claim.stayEndDate)}`;
  const data = { listingTitle: claim.listingTitle };
  if (event === 'CLAIM_OPENED') {
    return withLayout(`Dégradation déclarée après votre séjour — répondez avant le ${moment(damageResponseDeadline(claim))}`,
      `${hello}\n\nLe propriétaire a déclaré une dégradation après ${stay}.\n\nMontant demandé : ${euros(claim.requestedCents)}\n${claim.description}\n\nVous pouvez donner votre version, jusqu’au ${moment(damageResponseDeadline(claim))}, depuis votre espace Haven. Haven compare la déclaration avec les états des lieux d’entrée et de sortie et lit votre réponse avant toute décision.\n\nRien n’est prélevé sans décision de Haven, et jamais plus de ${euros(DAMAGE_DEPOSIT_POLICY.amountCents)}.`,
      data, appOrigin, 'Répondre depuis mon espace', '/dashboard');
  }
  if (event === 'TEAM_NEW_CLAIM') {
    return withLayout(`À examiner : dégradation déclarée — ${claim.listingTitle}`,
      `Bonjour,\n\nUne dégradation a été déclarée${claim.declaredBy ? ' par Haven' : ' par le propriétaire'} pour le séjour terminé le ${day(claim.stayEndDate)} à « ${claim.listingTitle} ».\n\nMontant demandé : ${euros(claim.requestedCents)}\n${claim.description}\n\nLe locataire a été prévenu et peut répondre jusqu’au ${moment(damageResponseDeadline(claim))}. La décision se prend dans Finances › Cautions.`,
      { listingTitle: 'Administration Haven' }, appOrigin, 'Ouvrir le back office', '/admin/dashboard');
  }
  const decision = claim.decision!;
  const rejected = claim.status === 'REJECTED';
  if (event === 'DECISION_TENANT') {
    return withLayout(rejected ? 'Déclaration de dégradation : aucun prélèvement' : `Déclaration de dégradation : ${euros(decision.amountCents)} retenus`,
      `${hello}\n\n${rejected
        ? `Haven a examiné la dégradation déclarée après ${stay} et ne l’a pas retenue. Aucun montant ne sera prélevé.`
        : `Haven a examiné la dégradation déclarée après ${stay} et a retenu ${euros(decision.amountCents)}. Ce montant est prélevé sur la carte enregistrée lors de votre réservation, puis reversé au propriétaire.`}\n\nExplication de Haven : ${decision.note}\n\nPour toute question, répondez simplement à cet e-mail.`,
      data, appOrigin, 'Mon espace', '/dashboard');
  }
  return withLayout(rejected ? 'Votre déclaration de dégradation n’a pas été retenue' : `Dégradation retenue : ${euros(decision.amountCents)}`,
    `${hello}\n\n${rejected
      ? `Haven a examiné votre déclaration pour le séjour terminé le ${day(claim.stayEndDate)} à « ${claim.listingTitle} » et ne l’a pas retenue : aucun montant ne sera prélevé au locataire.`
      : `Haven a retenu ${euros(decision.amountCents)} sur votre déclaration pour le séjour terminé le ${day(claim.stayEndDate)} à « ${claim.listingTitle} ». Le montant est prélevé au locataire puis versé sur votre compte de versements.`}\n\nExplication de Haven : ${decision.note}`,
    data, appOrigin, 'Mon espace propriétaire', '/owner/dashboard');
}
