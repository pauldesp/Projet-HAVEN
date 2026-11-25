/**
 * When Haven asks an owner for their tax details (DAC7), the way large platforms do it: never at sign-up or when
 * publishing, only once money has been collected for them (first paid booking). Then two reminders, and payouts are
 * held only if the details are still missing 60 days after the first request, as the directive allows.
 */
export const TAX_REQUEST_DEADLINE_DAYS = 60;
export const TAX_REMINDER_DAYS = [20, 40] as const;
const DAY = 86400_000;

export type OwnerTaxRequest = {
  ownerId: string;
  status: 'PENDING' | 'DONE';
  firstRequestAt: string;
  deadlineAt: string;
  remindersSent: number;
  nextReminderAt: string | null;
  completedAt?: string;
};

export function newTaxRequest(ownerId: string, at: string): OwnerTaxRequest {
  const start = Date.parse(at);
  return { ownerId, status: 'PENDING', firstRequestAt: at, deadlineAt: new Date(start + TAX_REQUEST_DEADLINE_DAYS * DAY).toISOString(),
    remindersSent: 0, nextReminderAt: new Date(start + TAX_REMINDER_DAYS[0] * DAY).toISOString() };
}

/** A reminder that is due now, with the update that schedules the next one (null when nothing is due). */
export function dueReminder(request: OwnerTaxRequest, now = Date.now()) {
  if (request.status !== 'PENDING' || !request.nextReminderAt || now < Date.parse(request.nextReminderAt)) return null;
  const sent = request.remindersSent + 1;
  const next = TAX_REMINDER_DAYS[sent];
  return { reminder: sent, update: { remindersSent: sent, nextReminderAt: next ? new Date(Date.parse(request.firstRequestAt) + next * DAY).toISOString() : null } };
}

/** Payouts wait only when the details are still missing after the 60-day deadline. */
export function taxHoldsPayouts(request: OwnerTaxRequest | undefined, profileComplete: boolean, now = Date.now()) {
  return !profileComplete && Boolean(request) && request!.status === 'PENDING' && now >= Date.parse(request!.deadlineAt);
}

export const daysLeft = (request: Pick<OwnerTaxRequest, 'deadlineAt'>, now = Date.now()) => Math.max(0, Math.ceil((Date.parse(request.deadlineAt) - now) / DAY));
