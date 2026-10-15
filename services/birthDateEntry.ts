export type BirthDateParts = [day: string, month: string, year: string];

export const partsFromBirthDate = (value: string): BirthDateParts => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? [match[3], match[2], match[1]] : ['', '', ''];
};

export const birthDateFromParts = ([day, month, year]: BirthDateParts) =>
  day.length === 2 && month.length === 2 && year.length === 4
    ? `${year}-${month}-${day}` : '';

export function updateBirthDatePart(parts: BirthDateParts, index: 0 | 1 | 2, raw: string) {
  const maxLength = index === 2 ? 4 : 2;
  const digits = raw.replace(/\D/g, '').slice(0, maxLength);
  const next = [...parts] as BirthDateParts;
  next[index] = digits;
  return { parts: next, value: birthDateFromParts(next), advance: index < 2 && digits.length === maxLength };
}

/** Accept a whole date pasted in either the display order or ISO order. */
export function parsePastedBirthDate(raw: string): BirthDateParts | null {
  const text = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) return [iso[3], iso[2], iso[1]];
  const local = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4})$/.exec(text);
  if (local) return [local[1].padStart(2, '0'), local[2].padStart(2, '0'), local[3]];
  if (/^\d{8}$/.test(text)) return [text.slice(0, 2), text.slice(2, 4), text.slice(4)];
  return null;
}
