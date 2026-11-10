import type { Firestore } from 'firebase-admin/firestore';

/** Background tasks of the server, as shown in the back office. */
export const SYSTEM_TASKS = {
  INSTALLMENTS: 'Prélèvements des séries',
  BOOKING_EXPIRY: 'Expiration des réservations non payées',
  MAIL_DELIVERY: 'Envoi des e-mails',
  TEAM_ALERTS: 'Alertes de signalements',
  OWNER_TRANSFERS: 'Transferts aux propriétaires',
  STRIPE_RECONCILIATION: 'Rapprochement Stripe',
  REVIEW_CLOSING: 'Clôture des avis',
  STRIPE_WEBHOOK: 'Notifications Stripe reçues',
} as const;
export type SystemTask = keyof typeof SYSTEM_TASKS;

export interface TaskHealth {
  task: SystemTask; lastRunAt?: string; lastSuccessAt?: string; lastErrorAt?: string; lastError?: string; consecutiveFailures: number; alertedAt?: string;
}

/** Consecutive failures before the Haven team is alerted. */
export const ALERT_AFTER_FAILURES = 3;
const PERSIST_EVERY_MS = 5 * 60_000;

export function nextTaskHealth(previous: TaskHealth | undefined, task: SystemTask, ok: boolean, error: string | undefined, at: string): TaskHealth {
  const base: TaskHealth = previous || { task, consecutiveFailures: 0 };
  if (ok) return { ...base, lastRunAt: at, lastSuccessAt: at, consecutiveFailures: 0, alertedAt: undefined };
  return { ...base, lastRunAt: at, lastErrorAt: at, lastError: (error || 'Erreur inconnue').slice(0, 300), consecutiveFailures: base.consecutiveFailures + 1 };
}

/** Alert once per failure streak, when it reaches the threshold. */
export const shouldAlert = (health: TaskHealth) => health.consecutiveFailures >= ALERT_AFTER_FAILURES && !health.alertedAt;

/** Keeps the state in memory and persists it when it changes, or every 5 minutes, to limit writes. */
export function createSystemHealth(db: Firestore, onAlert: (health: TaskHealth) => Promise<void>) {
  const state = new Map<SystemTask, TaskHealth>();
  const persistedAt = new Map<SystemTask, number>();
  async function record(task: SystemTask, ok: boolean, error?: unknown) {
    const at = new Date().toISOString();
    const previous = state.get(task);
    const next = nextTaskHealth(previous, task, ok, error instanceof Error ? error.message : error ? String(error) : undefined, at);
    const changed = !previous || (previous.consecutiveFailures === 0) !== ok;
    if (!ok && shouldAlert(next)) {
      next.alertedAt = at;
      await onAlert(next).catch(() => console.error('System alert could not be queued.'));
    }
    state.set(task, next);
    if (changed || !ok || Date.now() - (persistedAt.get(task) || 0) >= PERSIST_EVERY_MS) {
      persistedAt.set(task, Date.now());
      await db.collection('system_health').doc(task).set(JSON.parse(JSON.stringify(next))).catch(() => undefined);
    }
  }
  return {
    success: (task: SystemTask) => record(task, true),
    failure: (task: SystemTask, error?: unknown) => record(task, false, error),
    /** Runs a task and records its outcome; errors are recorded, never thrown. */
    track: async (task: SystemTask, run: () => Promise<unknown>) => {
      try { await run(); await record(task, true); } catch (error) { await record(task, false, error); }
    },
  };
}
