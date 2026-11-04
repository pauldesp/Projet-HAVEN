import { localDateKey } from './stay';

/** Calendar month before arrival, clamped to the last day of the previous month. */
export function monthBeforeArrival(arrival: string): string {
  const date = new Date(`${arrival}T12:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

/** Display projection only: this does not schedule or create Stripe charges. */
export function recurringPaymentSchedule(stays: { index: number; start: string; end: string; amount: number }[], now = new Date()) {
  const today = localDateKey(now);
  const entries = [...stays].sort((a, b) => a.start.localeCompare(b.start)).map((stay, index) => {
    const plannedDate = monthBeforeArrival(stay.start);
    const dueNow = index === 0 || plannedDate <= today;
    return { ...stay, dueNow, dueDate: dueNow ? today : plannedDate };
  });
  const dueNow = entries.filter(entry => entry.dueNow).reduce((sum, entry) => sum + entry.amount, 0);
  const later = entries.filter(entry => !entry.dueNow).reduce((sum, entry) => sum + entry.amount, 0);
  return { entries, dueNow, later, total: dueNow + later };
}
