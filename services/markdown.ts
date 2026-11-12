/**
 * Small, safe Markdown converter shared by the server (article pages) and the admin preview.
 * Supports: headings (## to ####), paragraphs, **bold**, *italic*, [links](url), ![images](url "caption"),
 * lists, numbered lists, > quotes, tables and --- separators. Raw HTML is always escaped.
 */
export const escapeHtml = (text: string) => text
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Only web links, site-relative links and anchors; anything else (javascript:, data:) is dropped. */
const safeUrl = (url: string) => /^(https?:\/\/|\/(?!\/)|#)/i.test(url.trim()) ? url.trim() : '';

function inline(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_m, alt, url, title) => {
    const src = safeUrl(url.replace(/&amp;/g, '&'));
    return src ? `<img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" decoding="async"${title ? ` title="${title}"` : ''}>` : '';
  });
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    const href = safeUrl(url.replace(/&amp;/g, '&'));
    if (!href) return label;
    const external = /^https?:\/\//i.test(href);
    return `<a href="${escapeHtml(href)}"${external ? ' rel="noopener" target="_blank"' : ''}>${label}</a>`;
  });
  return html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

const isTableRow = (line: string) => /^\|.*\|$/.test(line.trim());
const BLOCK_START = /^(#{1,4}\s|>|\s*[-*]\s|\s*\d+\.\s|---\s*$|!\[)/;

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const html: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      // A single h1 per page is the article title: content headings start at h2.
      const level = Math.max(2, heading[1].length);
      const text = heading[2].trim();
      html.push(`<h${level} id="${slugify(text)}">${inline(text)}</h${level}>`);
      index++; continue;
    }
    if (/^---\s*$/.test(line)) { html.push('<hr>'); index++; continue; }
    const image = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
    if (image) {
      const src = safeUrl(image[2]);
      if (src) html.push(`<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(image[1])}" loading="lazy" decoding="async">${image[3] ? `<figcaption>${inline(image[3])}</figcaption>` : ''}</figure>`);
      index++; continue;
    }
    if (isTableRow(line)) {
      const rows: string[][] = [];
      while (index < lines.length && isTableRow(lines[index])) rows.push(lines[index++].trim().slice(1, -1).split('|').map(cell => cell.trim()));
      const [head, separator, ...body] = rows;
      const hasHead = separator && separator.every(cell => /^:?-{2,}:?$/.test(cell));
      const bodyRows = hasHead ? body : rows.slice(1);
      html.push(`<div class="table"><table>${hasHead ? `<thead><tr>${head.map(cell => `<th>${inline(cell)}</th>`).join('')}</tr></thead>` : ''}<tbody>${(hasHead ? bodyRows : [head, ...bodyRows]).map(row => `<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length && (ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/).test(lines[index])) items.push(lines[index++].replace(/^\s*(?:[-*]|\d+\.)\s+/, ''));
      html.push(`<${ordered ? 'ol' : 'ul'}>${items.map(item => `<li>${inline(item)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (line.startsWith('>')) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].startsWith('>')) quote.push(lines[index++].replace(/^>\s?/, ''));
      html.push(`<blockquote><p>${quote.map(inline).join('<br>')}</p></blockquote>`);
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !BLOCK_START.test(lines[index]) && !isTableRow(lines[index])) paragraph.push(lines[index++].trim());
    if (paragraph.length) html.push(`<p>${inline(paragraph.join(' '))}</p>`);
    else index++;
  }
  return html.join('\n');
}

/** Plain text of a Markdown document (for descriptions, word counts and feeds). */
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '').replace(/^>\s?/gm, '').replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '')
    .replace(/[*`|]/g, '').replace(/^-{3,}$/gm, '')
    .replace(/\s+/g, ' ').trim();
}

/** URL-friendly identifier: lowercase, no accents, words joined by dashes. */
export function slugify(text: string): string {
  return text.toLocaleLowerCase('fr').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '');
}
