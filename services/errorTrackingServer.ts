import type { Firestore } from 'firebase-admin/firestore';
import { createRateGuard, mergeErrorGroup, prepareErrorReport, shouldAlert, type ErrorGroup, type ErrorReportInput } from './errorTracking';

/** Database writes for error reports per minute; enough to see any real problem, too few to loop. */
export const ERROR_RECORDS_PER_MINUTE = 20;

/** alertsEnabled: false in development, where the shared database must not mail the team for local errors. */
export function createErrorTracking(deps: { db: Firestore; notifyMail: () => void; alertsEnabled: boolean }) {
  const groups = deps.db.collection('error_reports');
  const outbox = deps.db.collection('reservation_mail_outbox');
  const alertTimes: number[] = [];
  const writes = createRateGuard(ERROR_RECORDS_PER_MINUTE, 60_000);

  /** Records one occurrence; never throws (error tracking must not create errors). */
  async function record(input: Partial<ErrorReportInput>) {
    try {
      const report = prepareErrorReport(input);
      if (!report || !writes.allow()) return;
      const at = new Date().toISOString();
      const hourAgo = Date.now() - 3600_000;
      while (alertTimes.length && alertTimes[0] < hourAgo) alertTimes.shift();
      const ref = groups.doc(report.fingerprint);
      const alerted = await deps.db.runTransaction(async transaction => {
        const current = (await transaction.get(ref)).data() as ErrorGroup | undefined;
        const { group, isNew } = mergeErrorGroup(current, report, at);
        const alert = deps.alertsEnabled && shouldAlert(isNew, alertTimes.length);
        transaction.set(ref, alert ? { ...group, alertedAt: at } : group);
        if (alert) transaction.set(outbox.doc(`${report.fingerprint}-${at.replace(/[^0-9]/g, '')}-HAVEN_ALERT`), {
          kind: 'HAVEN_ALERT', title: report.source === 'CLIENT' ? 'Erreur sur le site' : 'Erreur du serveur',
          message: `${report.message}${report.path ? ` (page ${report.path})` : ''}${report.browser ? ` · ${report.browser}` : ''}`,
          failures: group.count, occurredAt: at, status: 'PENDING', attempts: 0, nextAttemptAt: at,
        });
        return alert;
      });
      if (alerted) { alertTimes.push(Date.now()); deps.notifyMail(); }
    } catch (error) {
      console.error('Error tracking unavailable.', (error as { code?: unknown })?.code ?? '');
    }
  }

  async function list(): Promise<ErrorGroup[]> {
    const snapshot = await groups.orderBy('lastAt', 'desc').limit(100).get();
    return snapshot.docs.map(doc => doc.data() as ErrorGroup);
  }

  async function setResolved(id: string, resolved: boolean) {
    if (!/^(client|server)-[0-9a-f]{8}$/.test(id)) return false;
    const ref = groups.doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return false;
    await ref.update(resolved ? { status: 'RESOLVED', resolvedAt: new Date().toISOString() } : { status: 'OPEN' });
    return true;
  }

  return { record, list, setResolved };
}
