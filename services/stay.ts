/** Calendar nights: arrival is included, departure is excluded; independent of DST. */
export function countNights(arrival: string, departure: string): number {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
  };
  const nights = (parse(departure) - parse(arrival)) / 86400000;
  return Number.isInteger(nights) && nights > 0 ? nights : 0;
}
