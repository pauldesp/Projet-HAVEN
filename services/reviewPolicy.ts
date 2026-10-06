export const REVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function stayReviewDeadline(completedAt?: unknown, endDate?: unknown): number {
  const completedTime = typeof completedAt === 'string' ? Date.parse(completedAt) : NaN;
  const endTime = typeof endDate === 'string' ? Date.parse(endDate) : NaN;
  const base = Number.isFinite(completedTime) ? completedTime : endTime;
  return Number.isFinite(base) ? base + REVIEW_WINDOW_MS : NaN;
}

export function isStayReviewWindowOpen(completedAt?: unknown, endDate?: unknown, now = Date.now()): boolean {
  return now < stayReviewDeadline(completedAt, endDate);
}
