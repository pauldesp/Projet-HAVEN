import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownToHtml, slugify } from './markdown';
import { prepareArticleInput, seoChecklist } from './articles';
import { renderArticle, renderArticleList, renderSitemap } from './articlePages';
import type { Article } from './articles';

test('le Markdown est converti sans jamais laisser passer de HTML ni de lien dangereux', () => {
  const html = markdownToHtml('## Trouver une coloc\n\nUn **bon** conseil et un [lien](/#/search).\n\n<script>alert(1)</script>\n\n[piège](javascript:alert(1))\n\n- un\n- deux');
  assert.match(html, /<h2 id="trouver-une-coloc">Trouver une coloc<\/h2>/);
  assert.match(html, /<strong>bon<\/strong>/);
  assert.match(html, /<a href="\/#\/search">lien<\/a>/);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('javascript:'));
  assert.match(html, /<ul><li>un<\/li><li>deux<\/li><\/ul>/);
  assert.match(markdownToHtml('# Titre'), /^<h2/, 'le seul h1 est le titre de l’article');
});

test('l’adresse d’un article est lisible et sans accent', () => {
  assert.equal(slugify('Trouver une colocation à Lyon : nos 7 conseils !'), 'trouver-une-colocation-a-lyon-nos-7-conseils');
});

test('un article publié doit avoir un vrai contenu, et la liste de contrôle signale les manques', () => {
  assert.throws(() => prepareArticleInput({ title: 'Titre court ok', content: 'Trop court.', status: 'PUBLISHED' }), /50 mots/);
  const draft = prepareArticleInput({ title: 'Colocation à Lyon : le guide', content: 'Texte.', status: 'DRAFT', tags: ['colocation'] });
  assert.equal(draft.slug, 'colocation-a-lyon-le-guide');
  const checks = seoChecklist({ ...draft });
  assert.equal(checks.find(check => check.label === 'Mot-clé principal')?.ok, true);
  assert.equal(checks.find(check => check.label === 'Longueur du texte')?.ok, false);
});

const article: Article = {
  id: 'a1b2c3d4', slug: 'colocation-lyon', title: 'Colocation à Lyon : le guide <complet>', excerpt: 'Tout pour trouver une chambre à Lyon.',
  content: '## Quartiers\n\nTexte du guide.', category: 'Villes', tags: ['colocation lyon'], coverImageId: 'img123456', coverAlt: 'Salon lumineux',
  status: 'PUBLISHED', authorName: 'Équipe Haven', createdAt: '2026-11-10T10:00:00Z', updatedAt: '2026-11-12T10:00:00Z', publishedAt: '2026-11-10T10:00:00Z',
};

test('la page d’un article contient tout ce que Google attend', () => {
  const html = renderArticle(article, [], 'https://havencoloc.fr');
  assert.match(html, /<title>Colocation à Lyon : le guide &lt;complet&gt; \| Haven<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/havencoloc.fr\/articles\/colocation-lyon">/);
  assert.match(html, /<meta name="description" content="Tout pour trouver une chambre à Lyon.">/);
  assert.match(html, /og:image" content="https:\/\/havencoloc.fr\/articles\/images\/img123456"/);
  assert.match(html, /"@type":"BlogPosting"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.equal(html.match(/<h1/g)?.length, 1);
  assert.match(html, /mis à jour le/);
});

test('la liste et le plan du site recensent les articles publiés', () => {
  const summary = { ...article, readingMinutes: 1 };
  assert.match(renderArticleList([summary], 'https://havencoloc.fr', ['Villes']), /href="\/articles\/colocation-lyon"/);
  const sitemap = renderSitemap([article], 'https://havencoloc.fr');
  assert.match(sitemap, /<loc>https:\/\/havencoloc.fr\/articles\/colocation-lyon<\/loc><lastmod>2026-11-12<\/lastmod>/);
  assert.match(sitemap, /<image:loc>/);
});
