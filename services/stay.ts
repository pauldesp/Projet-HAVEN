/** Calendar nights: arrival is included, departure is excluded; independent of DST. */
const parseCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
};

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
