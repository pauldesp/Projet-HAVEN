const next = (date: string) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};

/** Every night from `from` to `to`, both included (YYYY-MM-DD). */
export function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to && dates.length < 732; date = next(date)) dates.push(date);
  return dates;
}

/** Consecutive blocked nights grouped into readable periods. */
export function blockedRanges(dates: string[]) {
  const sorted = [...new Set(dates)].sort();
  const ranges: { start: string; end: string; nights: number }[] = [];
  for (const date of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && next(last.end) === date) { last.end = date; last.nights++; }
    else ranges.push({ start: date, end: date, nights: 1 });
  }
  return ranges;
}

export const withoutDates = (dates: string[], removed: string[]) => dates.filter(date => !removed.includes(date));
