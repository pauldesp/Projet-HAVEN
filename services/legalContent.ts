import { sanitizeHtml } from './sanitizeHtml';

const NBSP = String.fromCharCode(0xa0);
const NON_BREAKING_SPACES = new RegExp(`(?:&nbsp;|${NBSP})+`, 'g');

/**
 * Pasted legal documents often separate every word with a non-breaking space,
 * which leaves the browser no choice but to split words mid-way on a phone.
 * French typography still needs them inside « » and before ; : ! ? % €.
 */
export function normalizeLegalSpacing(html: string): string {
  return html.replace(NON_BREAKING_SPACES, (match, offset: number, whole: string) => {
    const before = whole[offset - 1];
    const after = whole[offset + match.length] ?? '';
    return before === '«' || /[»;:!?%€]/.test(after) ? NBSP : ' ';
  });
}

export function readableLegalHtml(content: string): string {
  return sanitizeHtml(normalizeLegalSpacing(content).replace(/<p>\s*<\/p>/g, ''));
}
