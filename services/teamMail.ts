import type { Report } from '../types';
import { withLayout } from './reservationMail';
import { SYSTEM_TASKS, type SystemTask, type TaskHealth } from './systemHealth';

/** Reports created before this date are not announced again when the alerts are switched on. */
export const TEAM_ALERTS_START = '2026-11-10T00:00:00.000Z';

export interface TeamMailJob {
  kind: 'HAVEN_REPORT' | 'HAVEN_ALERT'; reportId?: string; occurredAt: string; status: 'PENDING'; attempts: number; nextAttemptAt: string;
  task?: SystemTask; message?: string; failures?: number;
  /** Overrides the task name, e.g. for application errors. */
  title?: string;
}
export interface TeamMailData {
  report?: Report;
  reporter?: { firstName?: string; lastName?: string };
  listingTitle?: string;
}

export const isTeamMailKind = (value: unknown): value is TeamMailJob['kind'] => value === 'HAVEN_REPORT' || value === 'HAVEN_ALERT';

/** A background task failed several times in a row. */
export const teamAlertMailJob = (health: TaskHealth): TeamMailJob => {
  const at = health.lastErrorAt || new Date().toISOString();
  return { kind: 'HAVEN_ALERT', task: health.task, message: health.lastError || 'Erreur inconnue', failures: health.consecutiveFailures, occurredAt: at, status: 'PENDING', attempts: 0, nextAttemptAt: at };
};

/** Address of the Haven team: dedicated variable, otherwise the reply-to or the Resend account holder's test address. */
export function teamMailRecipient(env: Record<string, string | undefined>) {
  return [env.HAVEN_TEAM_EMAIL, env.EMAIL_REPLY_TO, env.RESEND_TEST_EMAIL_TO].map(value => value?.trim()).find(Boolean) || '';
}

/** A new report, not yet announced, created after the alerts were switched on. */
export function teamReportToAnnounce(report: Pick<Report, 'status' | 'timestamp'> & { teamMailQueuedAt?: string }) {
  return report.status === 'NEW' && !report.teamMailQueuedAt && Number.isFinite(Date.parse(report.timestamp)) && report.timestamp >= TEAM_ALERTS_START;
}

export const teamReportMailJob = (report: Pick<Report, 'id' | 'timestamp'>, at = new Date().toISOString()): TeamMailJob =>
  ({ kind: 'HAVEN_REPORT', reportId: report.id, occurredAt: report.timestamp, status: 'PENDING', attempts: 0, nextAttemptAt: at });

export function teamMailDisposition(job: TeamMailJob, data: TeamMailData, recipient: string, now = Date.now()): 'SEND' | 'CANCELLED' | 'EXPIRED' {
  if (!recipient || (job.kind === 'HAVEN_REPORT' && !data.report)) return 'CANCELLED';
  if (now - Date.parse(job.occurredAt) >= 7 * 86400_000) return 'EXPIRED';
  return 'SEND';
}

const REASONS: Record<string, string> = {
  OFFENSIVE: 'Contenu inapproprié', SPAM: 'Annonce en double ou spam', INACCURATE: 'Annonce mensongère ou inexacte',
  FRAUD: 'Arnaque ou tentative de fraude', TECHNICAL_ISSUE: 'Problème technique', OTHER: 'Autre problème',
};
const instant = (value: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(value));

export function teamMailValues(job: TeamMailJob, data: TeamMailData): Record<string, string> {
  if (job.kind === 'HAVEN_ALERT') return {
    PRENOM_DESTINATAIRE: 'équipe Haven', MENTION_TEST: '', REFERENCE_DOSSIER: 'Surveillance Haven', DATE_ACTION: instant(job.occurredAt),
    TACHE: job.title || (job.task ? SYSTEM_TASKS[job.task] : 'Tâche automatique'), MESSAGE_ERREUR: job.message || 'Erreur inconnue', NOMBRE_ECHECS: String(job.failures || 0),
  };
  const report = data.report!;
  const type = report.incidentId ? 'Demande d’intervention sur un incident' : report.bookingId ? 'Problème de séjour transmis à Haven'
    : report.targetType === 'LISTING' ? 'Signalement d’annonce' : 'Signalement';
  return {
    PRENOM_DESTINATAIRE: 'équipe Haven', MENTION_TEST: '', REFERENCE_DOSSIER: `Signalement · ${report.id}`,
    TYPE_SIGNALEMENT: type, LOGEMENT: data.listingTitle || 'Logement non précisé',
    AUTEUR: [data.reporter?.firstName || 'Un membre', data.reporter?.lastName ? `${data.reporter.lastName.charAt(0).toUpperCase()}.` : ''].filter(Boolean).join(' '),
    DATE_ACTION: instant(report.timestamp || job.occurredAt),
    MOTIF_SIGNALEMENT: report.supportCategory || REASONS[report.reason] || 'Autre problème',
    DESCRIPTION_SIGNALEMENT: report.description || 'Aucune précision.',
  };
}

export function teamNotificationEmail(job: TeamMailJob, data: TeamMailData, appOrigin?: string) {
  const values = teamMailValues(job, data);
  if (job.kind === 'HAVEN_ALERT') return withLayout(`Alerte : ${values.TACHE}`, `Bonjour,\n\nLa tâche « ${values.TACHE} » a échoué ${values.NOMBRE_ECHECS} fois de suite (dernier échec le ${values.DATE_ACTION}).\n\nErreur : ${values.MESSAGE_ERREUR}\n\nConsultez l’onglet Surveillance du back office.`, { listingTitle: 'Administration Haven' }, appOrigin, 'Ouvrir le back office', '/admin/dashboard');
  const text = `Bonjour,\n\nUn nouveau signalement a été transmis à Haven le ${values.DATE_ACTION}.\n\n${values.TYPE_SIGNALEMENT}\n${values.LOGEMENT}\nSignalé par ${values.AUTEUR}\n\nMotif : ${values.MOTIF_SIGNALEMENT}\n${values.DESCRIPTION_SIGNALEMENT}\n\n${values.REFERENCE_DOSSIER}`;
  return withLayout(`À traiter : ${values.TYPE_SIGNALEMENT} — ${values.LOGEMENT}`, text, { listingTitle: 'Administration Haven' }, appOrigin, 'Ouvrir le back office', '/admin/dashboard');
}
