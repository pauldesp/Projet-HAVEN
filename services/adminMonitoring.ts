import { ALERT_AFTER_FAILURES, type SystemTask, type TaskHealth } from './systemHealth';

/** Normal interval of each task; the webhook has none (it depends on Stripe activity). */
const EXPECTED_EVERY_MS: Partial<Record<SystemTask, number>> = {
  INSTALLMENTS: 60_000, BOOKING_EXPIRY: 60_000, MAIL_DELIVERY: 30_000, TEAM_ALERTS: 30_000, OWNER_TRANSFERS: 30_000,
  STRIPE_RECONCILIATION: 5 * 60_000, REVIEW_CLOSING: 60 * 60_000,
};

export function taskStatus(task: SystemTask, health: TaskHealth | undefined, now = Date.now()): { tone: 'ok' | 'warning' | 'error' | 'idle'; label: string } {
  if (!health?.lastRunAt) return { tone: 'idle', label: task === 'STRIPE_WEBHOOK' ? 'Aucune notification reçue depuis le démarrage' : 'Aucune exécution enregistrée' };
  if (health.consecutiveFailures >= ALERT_AFTER_FAILURES) return { tone: 'error', label: `En échec (${health.consecutiveFailures} fois de suite), alerte envoyée` };
  if (health.consecutiveFailures > 0) return { tone: 'warning', label: `Échec récent (${health.consecutiveFailures}), nouvel essai automatique` };
  const every = EXPECTED_EVERY_MS[task];
  // Health is persisted at most every 5 minutes while all is well.
  if (every && health.lastSuccessAt && now - Date.parse(health.lastSuccessAt) > 3 * every + 6 * 60_000) return { tone: 'warning', label: 'En retard : le serveur est peut-être arrêté' };
  return { tone: 'ok', label: task === 'STRIPE_WEBHOOK' ? 'Notifications reçues normalement' : 'Fonctionne normalement' };
}

const STATUS: Record<string, string> = {
  PENDING: 'En attente', SENDING: 'Envoi en cours', SENT: 'Envoyé', RETRY: 'Nouvel essai prévu', REVIEW_REQUIRED: 'À vérifier',
  WAITING_DOMAIN: 'Bloqué : domaine Resend à valider', CANCELLED: 'Annulé (événement plus valable)', EXPIRED: 'Expiré',
};
export const mailStatusLabel = (status: string) => STATUS[status] || status;

const KINDS: Record<string, string> = {
  CONFIRMATION: 'Réservation confirmée', ARRIVAL: 'Préparer mon arrivée', CHECKIN: 'Entrée enregistrée', DEPARTURE_REMINDER: 'Préparer mon départ', CHECKOUT: 'Départ enregistré',
  ACCOUNT_APPROVED: 'Compte validé', ACCOUNT_CORRECTION: 'Dossier à corriger', CANCELLED: 'Réservation annulée', REVIEW_INVITE: 'Invitation à laisser un avis',
  SERIES_CONFIRMED: 'Série réservée', INSTALLMENT_UPCOMING: 'Prochain prélèvement', INSTALLMENT_FAILED: 'Prélèvement échoué', INSTALLMENT_UNPAID: 'Séjour annulé faute de paiement',
  OWNER_BOOKING: 'Propriétaire · nouvelle réservation', OWNER_SERIES: 'Propriétaire · série', OWNER_CANCELLED: 'Propriétaire · annulation', OWNER_INCIDENT: 'Propriétaire · signalement', OWNER_PAYOUT: 'Propriétaire · virement',
  HAVEN_REPORT: 'Équipe · signalement', HAVEN_ALERT: 'Équipe · alerte technique',
};
export const mailKindLabel = (kind: string) => KINDS[kind] || kind;
