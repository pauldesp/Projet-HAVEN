/** Calendar nights: arrival is included, departure is excluded; independent of DST. */
const parseCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
};

/**
 * Today's date in Paris (YYYY-MM-DD), whatever the clock of the server or browser: between midnight and
 * 1 am (2 am in summer) the UTC date is still yesterday, which shifted cancellation tiers by a day.
 */
export const parisDateKey = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export const localDateKey = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/** A booking can start today, but never before the day the request is made. */
export const isBookableStay = (arrival: string, departure: string, now = new Date()) =>
  Number.isFinite(parseCalendarDate(arrival)) &&
  arrival >= localDateKey(now) &&
  countNights(arrival, departure) > 0;

export function countNights(arrival: string, departure: string): number {
  const nights = (parseCalendarDate(departure) - parseCalendarDate(arrival)) / 86400000;
  return Number.isInteger(nights) && nights > 0 ? nights : 0;
}

/** Longest continuous stay allowed (conditions de réservation): one booking, one stay of a series, or stays that follow each other. */
export const MAX_STAY_NIGHTS = 90;
export const MAX_STAY_MESSAGE = `Un séjour ne peut pas dépasser ${MAX_STAY_NIGHTS} nuits d’affilée, y compris lorsque plusieurs séjours se suivent sans interruption.`;

/** Departure date that gives exactly `nights` nights from the arrival (YYYY-MM-DD). */
export function addNights(arrival: string, nights: number): string {
  const date = new Date(parseCalendarDate(arrival) + nights * 86400000);
  return date.toISOString().slice(0, 10);
}

/**
 * Longest run of nights spent without a night off: a stay whose arrival is the previous departure day (or earlier)
 * continues the same run.
 */
export function longestContinuousNights(stays: { startDate: string; endDate: string }[]): number {
  const sorted = stays.filter(stay => countNights(stay.startDate, stay.endDate) > 0).sort((a, b) => a.startDate.localeCompare(b.startDate));
  let longest = 0;
  let runStart = '';
  let runEnd = '';
  for (const stay of sorted) {
    if (runEnd && stay.startDate <= runEnd) { if (stay.endDate > runEnd) runEnd = stay.endDate; }
    else { runStart = stay.startDate; runEnd = stay.endDate; }
    longest = Math.max(longest, countNights(runStart, runEnd));
  }
  return longest;
}
