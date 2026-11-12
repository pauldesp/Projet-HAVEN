// Legal documents of Haven: Markdown sources in docs/juridique, published as HTML in Firestore (settings collection),
// where the site, the footer and the booking window read them.
//   node scripts/legal-documents.mjs check     converts every document and lists what is still to complete (read only)
//   node scripts/legal-documents.mjs preview   writes the HTML next to the sources, in docs/juridique/apercu/ (read only)
//   node scripts/legal-documents.mjs publish   publishes the documents to Firestore (production content: only once validated)
// The "BROUILLON" box at the top of each source is internal and never published.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const DOCUMENTS = [
  { id: 'conditions-generales', file: 'conditions-generales-utilisation.md', title: 'Conditions générales d’utilisation' },
  { id: 'conditions-generales-de-reservation', file: 'conditions-generales-de-reservation.md', title: 'Conditions générales de réservation' },
  { id: 'conditions-proprietaires', file: 'conditions-proprietaires.md', title: 'Conditions propriétaires' },
  { id: 'cahier-des-charges-logement-proprietaire', file: 'cahier-des-charges-logement.md', title: 'Cahier des charges du logement' },
  { id: 'politique-de-confidentialite', file: 'politique-de-confidentialite.md', title: 'Politique de confidentialité' },
  { id: 'mentions-legales', file: 'mentions-legales.md', title: 'Mentions légales' },
];
const root = new URL('../docs/juridique/', import.meta.url);

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (text) => escape(text)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2">$1</a>');

/** Small converter for the subset used in the sources: headings, paragraphs, lists, tables, quotes, bold. */
export function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const html = [];
  let index = 0;
  const isTable = (line) => /^\|.*\|$/.test(line.trim());
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) { html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); index++; continue; }
    if (isTable(line)) {
      const rows = [];
      while (index < lines.length && isTable(lines[index])) rows.push(lines[index++].trim().slice(1, -1).split('|').map(cell => cell.trim()));
      const [head, , ...body] = rows;
      html.push(`<div class="legal-table"><table><thead><tr>${head.map(cell => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${body.map(row => `<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (index < lines.length && (ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/).test(lines[index])) items.push(lines[index++].replace(/^\s*(?:[-*]|\d+\.)\s+/, ''));
      html.push(`<${ordered ? 'ol' : 'ul'}>${items.map(item => `<li>${inline(item)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (line.startsWith('>')) {
      const quote = [];
      while (index < lines.length && lines[index].startsWith('>')) quote.push(lines[index++].replace(/^>\s?/, ''));
      html.push(`<blockquote><p>${quote.map(inline).join('<br>')}</p></blockquote>`);
      continue;
    }
    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,4}\s|>|\s*[-*]\s|\s*\d+\.\s)/.test(lines[index]) && !isTable(lines[index])) paragraph.push(lines[index++].trim());
    html.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  return html.join('\n');
}

/** Removes the internal draft box and the document's own title (the page shows the title). */
export function publishableMarkdown(source) {
  return source.replace(/^# .*\n+/, '').replace(/^(> .*\n)+\n*/m, '').trim();
}

const command = process.argv[2] || 'check';
const converted = DOCUMENTS.map(doc => {
  const source = readFileSync(new URL(doc.file, root), 'utf8');
  const body = publishableMarkdown(source);
  // Any [bracketed placeholder] (not a link) or boxed point still to settle.
  const todo = [...body.matchAll(/\[[^\]]+\](?!\()|\*\*À (?:valider|décider|DÉCIDER)[^*]*\*\*/g)].length;
  return { ...doc, html: markdownToHtml(body), todo };
});

if (command === 'check' || command === 'preview') {
  for (const doc of converted) console.log(`${doc.id.padEnd(42)} ${String(doc.html.length).padStart(6)} caractères · ${doc.todo ? `${doc.todo} point(s) à compléter ou valider` : 'prêt'}`);
  if (command === 'preview') {
    const out = new URL('apercu/', root);
    mkdirSync(out, { recursive: true });
    for (const doc of converted) writeFileSync(new URL(`${doc.id}.html`, out), `<!doctype html><meta charset="utf-8"><title>${doc.title}</title><body style="font-family:system-ui;max-width:760px;margin:40px auto;line-height:1.6;padding:0 16px"><h1>${doc.title}</h1>${doc.html}</body>`);
    console.log('Aperçus écrits dans docs/juridique/apercu/');
  }
} else if (command === 'publish') {
  const pending = converted.filter(doc => doc.todo);
  if (pending.length && !process.argv.includes('--force')) {
    console.error(`Publication refusée : ${pending.map(doc => doc.id).join(', ')} contiennent encore des points à compléter ou valider (ajoutez --force pour publier quand même un brouillon).`);
    process.exit(1);
  }
  const require = createRequire(import.meta.url);
  const { initializeApp, applicationDefault } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const config = JSON.parse(readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8'));
  const db = getFirestore(initializeApp({ credential: applicationDefault(), projectId: config.projectId }), config.firestoreDatabaseId);
  const at = new Date().toISOString();
  for (const doc of converted) {
    await db.collection('settings').doc(doc.id).set({ id: doc.id, title: doc.title, content: doc.html, lastUpdated: at, updatedBy: 'scripts/legal-documents.mjs' });
    console.log(`Publié : ${doc.title}`);
  }
} else {
  console.error('Commande inconnue. Utilisez check, preview ou publish.');
  process.exit(1);
}
