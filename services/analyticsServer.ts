import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { addToDelta, parisDayAndHour, validEvent, type AnalyticsDay, type AnalyticsDelta, type AnalyticsEvent } from './analytics';

const MAX_EVENTS_PER_REQUEST = 20;
/** Daily totals contain no personal data; they are kept 25 months to compare a month with the same month last year. */
const RETENTION_DAYS = 25 * 31;

/**
 * Events are added up in memory and written once a minute: a single document per day, never one per visit.
 * `collection` differs between production and development so local tests never mix with real visits.
 */
export function createAnalytics(deps: { db: Firestore; collection: string }) {
  const days = deps.db.collection(deps.collection);
  let pending = new Map<string, AnalyticsDelta>();

  function record(input: unknown) {
    const list = Array.isArray(input) ? input.slice(0, MAX_EVENTS_PER_REQUEST) : [];
    const events = list.map(validEvent).filter((event): event is AnalyticsEvent => event !== null);
    if (!events.length) return 0;
    const { date, hour } = parisDayAndHour();
    pending.set(date, addToDelta(pending.get(date) || {}, events, hour));
    return events.length;
  }

  /** Writes the totals gathered since the last flush as increments (safe with several server instances). */
  async function flush() {
    if (!pending.size) return;
    const batch = pending;
    pending = new Map();
    for (const [date, delta] of batch) {
      const update: Record<string, unknown> = { date };
      for (const [key, value] of Object.entries(delta)) {
        update[key] = typeof value === 'number' ? FieldValue.increment(value)
          : Object.fromEntries(Object.entries(value as Record<string, number>).map(([name, count]) => [name, FieldValue.increment(count)]));
      }
      try { await days.doc(date).set(update, { merge: true }); }
      catch (error) {
        // Put the totals back for the next attempt rather than losing them.
        const again = pending.get(date) || {};
        pending.set(date, mergeDeltas(again, delta));
        throw error;
      }
    }
  }

  async function read(from: string, to: string): Promise<AnalyticsDay[]> {
    const snapshot = await days.where('date', '>=', from).where('date', '<=', to).get();
    return snapshot.docs.map(doc => doc.data() as AnalyticsDay).sort((a, b) => a.date.localeCompare(b.date));
  }

  async function purgeOld(now = new Date()) {
    const limit = new Date(now.getTime() - RETENTION_DAYS * 86400_000).toISOString().slice(0, 10);
    const old = await days.where('date', '<', limit).limit(200).get();
    await Promise.all(old.docs.map(doc => doc.ref.delete()));
  }

  return { record, flush, read, purgeOld };
}

function mergeDeltas(a: AnalyticsDelta, b: AnalyticsDelta): AnalyticsDelta {
  const result: Record<string, unknown> = { ...a };
  for (const [key, value] of Object.entries(b)) {
    if (typeof value === 'number') result[key] = (Number(result[key]) || 0) + value;
    else {
      const map = { ...(result[key] as Record<string, number> || {}) };
      for (const [name, count] of Object.entries(value as Record<string, number>)) map[name] = (map[name] || 0) + count;
      result[key] = map;
    }
  }
  return result as AnalyticsDelta;
}
