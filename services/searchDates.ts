export function readSearchDates(params: URLSearchParams, today = new Date()) {
  const start = params.get('start') || '';
  const end = params.get('end') || '';
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (!valid(start) || start < localToday) return { start: '', end: '' };
  return { start, end: valid(end) && end > start ? end : '' };
}

export function listingSearchLink(id: string, params: URLSearchParams) {
  const dates = readSearchDates(params);
  const next = new URLSearchParams();
  if (dates.start) next.set('start', dates.start);
  if (dates.end) next.set('end', dates.end);
  return `/listing/${id}${next.size ? `?${next}` : ''}`;
}
