import { metaDescription, metaTitle, readingMinutes, type Article, type ArticleSummary } from './articles';
import { escapeHtml as e, markdownToHtml } from './markdown';

/**
 * Server-rendered article pages: complete HTML (title, description, canonical, Open Graph, structured data)
 * is sent to search engines and visitors without waiting for the application to load.
 */
const SITE = 'Haven';
const dateFr = (iso?: string) => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }) : '';
const imageUrl = (origin: string, id?: string) => id ? `${origin}/articles/images/${id}` : `${origin}/haven-colocation-contemporaine.jpg`;
const jsonLd = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

const STYLE = `
@font-face{font-family:'Inter Variable';font-style:normal;font-display:swap;font-weight:100 900;src:url(/fonts/inter.woff2) format('woff2')}
@font-face{font-family:'DM Sans Variable';font-style:normal;font-display:swap;font-weight:100 1000;src:url(/fonts/dm-sans.woff2) format('woff2')}
:root{--navy:#1E293B;--red:#A34343;--cream:#FDFCFB;--muted:#64748B;--line:#E5E7EB}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--cream);color:var(--navy);font:16px/1.7 'Inter Variable',system-ui,sans-serif}
a{color:var(--red)}img{max-width:100%;height:auto}
.wrap{max-width:1100px;margin:0 auto;padding:0 20px}
header.site{border-bottom:1px solid var(--line);background:#fff}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;min-height:68px;gap:16px}
header.site img{height:34px;width:auto;display:block}
header.site nav{display:flex;gap:18px;font-size:14px;font-weight:600}
header.site nav a{color:var(--navy);text-decoration:none}
header.site nav a.cta{background:var(--navy);color:#fff;padding:9px 16px;border-radius:12px}
h1,h2,h3,h4{font-family:'DM Sans Variable',system-ui,sans-serif;line-height:1.2;color:var(--navy)}
.crumbs{font-size:13px;color:var(--muted);margin:28px 0 0}.crumbs a{color:var(--muted);text-decoration:none}
.hero{padding:40px 0 24px}.hero h1{font-size:clamp(30px,5vw,46px);margin:8px 0 12px;font-weight:800}
.hero p{color:var(--muted);font-size:18px;max-width:680px;margin:0}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:24px 0}
.chips a{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 14px;font-size:14px;font-weight:600;color:var(--navy);text-decoration:none}
.chips a[aria-current]{background:var(--navy);border-color:var(--navy);color:#fff}
.grid{display:grid;gap:22px;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));padding:8px 0 56px}
.card{background:#fff;border:1px solid var(--line);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;text-decoration:none;color:inherit;transition:box-shadow .2s}
.card:hover{box-shadow:0 12px 30px -12px rgba(30,41,59,.25)}
.card img,.card .nocover{display:block;aspect-ratio:16/9;object-fit:cover;width:100%;background:linear-gradient(135deg,#1E293B,#A34343)}
.card div{padding:18px 20px 22px}.card h2{font-size:20px;margin:6px 0 8px}.card p{margin:0;color:var(--muted);font-size:15px}
.meta{font-size:13px;color:var(--muted)}.cat{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--red)}
article.post{max-width:740px;margin:0 auto;padding:0 0 40px}
article.post .cover{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:22px;margin:8px 0 28px;background:#F1F5F9}
.body{font-size:18px}.body h2{font-size:28px;margin:44px 0 12px}.body h3{font-size:22px;margin:32px 0 8px}
.body p,.body ul,.body ol{margin:0 0 20px}.body li{margin:6px 0}
.body blockquote{margin:28px 0;padding:6px 22px;border-left:4px solid var(--red);background:#fff;border-radius:0 14px 14px 0;color:#334155}
.body figure{margin:28px 0}.body figure img{border-radius:16px}.body figcaption{font-size:14px;color:var(--muted);text-align:center;margin-top:8px}
.body .table{overflow-x:auto;margin:0 0 24px}.body table{border-collapse:collapse;min-width:100%;font-size:15px}
.body th,.body td{border:1px solid var(--line);padding:9px 12px;text-align:left}.body th{background:#F8FAFC}
.body hr{border:0;border-top:1px solid var(--line);margin:36px 0}.body code{background:#F1F5F9;padding:2px 6px;border-radius:6px;font-size:.9em}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin:32px 0 0;padding:0;list-style:none}.tags li{background:#F1F5F9;border-radius:999px;padding:4px 12px;font-size:13px}
.cta-box{background:var(--navy);color:#fff;border-radius:22px;padding:30px;margin:44px 0;text-align:center}
.cta-box h2{color:#fff;margin:0 0 8px;font-size:24px}.cta-box p{color:#CBD5E1;margin:0 0 18px}
.cta-box a{display:inline-block;background:#fff;color:var(--navy);font-weight:700;text-decoration:none;padding:12px 22px;border-radius:14px}
.related{border-top:1px solid var(--line);padding:36px 0 56px}.related h2{font-size:24px}
.empty{background:#fff;border:1px dashed var(--line);border-radius:20px;padding:40px;text-align:center;color:var(--muted);margin-bottom:56px}
footer.site{border-top:1px solid var(--line);background:#fff;padding:28px 0;font-size:14px;color:var(--muted)}
footer.site .wrap{display:flex;flex-wrap:wrap;gap:12px 22px;justify-content:space-between}footer.site a{color:var(--muted);text-decoration:none}
@media (max-width:640px){header.site nav a:not(.cta){display:none}.body{font-size:17px}.body h2{font-size:24px}}
`;

function layout(options: { title: string; description: string; canonical: string; image: string; type: 'website' | 'article'; body: string; head?: string; noindex?: boolean }) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(options.title)}</title>
<meta name="description" content="${e(options.description)}">
<link rel="canonical" href="${e(options.canonical)}">
<meta name="robots" content="${options.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
<meta property="og:site_name" content="${SITE}">
<meta property="og:locale" content="fr_FR">
<meta property="og:type" content="${options.type}">
<meta property="og:title" content="${e(options.title)}">
<meta property="og:description" content="${e(options.description)}">
<meta property="og:url" content="${e(options.canonical)}">
<meta property="og:image" content="${e(options.image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1E293B">
<link rel="icon" type="image/png" href="/logo.png">
<link rel="alternate" type="application/rss+xml" title="Articles Haven" href="/articles/feed.xml">
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
${options.head || ''}
<style>${STYLE}</style>
</head>
<body>
<header class="site"><div class="wrap">
<a href="/" aria-label="Haven, accueil"><img src="/logo-600.png" alt="Haven" width="112" height="34"></a>
<nav aria-label="Navigation principale"><a href="/articles">Articles</a><a href="/#/how-it-works">Comment ça marche</a><a class="cta" href="/#/search">Trouver une chambre</a></nav>
</div></header>
<main class="wrap">${options.body}</main>
<footer class="site"><div class="wrap">
<span>© ${new Date().getFullYear()} Haven · La colocation flexible</span>
<span><a href="/">Accueil</a> · <a href="/articles">Articles</a> · <a href="/#/help">Aide</a> · <a href="/#/become-owner">Propriétaires</a> · <a href="/#/contact">Contact</a></span>
</div></footer>
</body>
</html>`;
}

const card = (article: ArticleSummary) => `<a class="card" href="/articles/${e(article.slug)}">
${article.coverImageId ? `<img src="/articles/images/${e(article.coverImageId)}" alt="${e(article.coverAlt || '')}" loading="lazy" width="640" height="360">` : '<span class="nocover" aria-hidden="true"></span>'}
<div><span class="cat">${e(article.category)}</span><h2>${e(article.title)}</h2><p>${e(article.excerpt)}</p><p class="meta" style="margin-top:12px">${dateFr(article.publishedAt)} · ${article.readingMinutes} min de lecture</p></div></a>`;

export function renderArticleList(list: ArticleSummary[], origin: string, categories: string[], category?: string) {
  const shown = category ? list.filter(article => article.category === category) : list;
  const canonical = `${origin}/articles${category ? `?categorie=${encodeURIComponent(category)}` : ''}`;
  const title = category ? `${category} : articles et conseils | ${SITE}` : `Articles et conseils colocation | ${SITE}`;
  const description = category
    ? `Nos articles « ${category} » : conseils pratiques pour la colocation, les stages, l’alternance et la location de chambres meublées.`
    : 'Conseils pour trouver une colocation, préparer un stage ou une alternance, louer une chambre meublée : les articles de Haven.';
  const body = `<p class="crumbs"><a href="/">Accueil</a> › ${category ? `<a href="/articles">Articles</a> › ${e(category)}` : 'Articles'}</p>
<div class="hero"><span class="cat">Le blog Haven</span><h1>${category ? e(category) : 'Articles et conseils'}</h1><p>${e(description)}</p></div>
${categories.length > 1 ? `<nav class="chips" aria-label="Catégories"><a href="/articles"${category ? '' : ' aria-current="page"'}>Tous</a>${categories.map(item => `<a href="/articles?categorie=${encodeURIComponent(item)}"${item === category ? ' aria-current="page"' : ''}>${e(item)}</a>`).join('')}</nav>` : ''}
${shown.length ? `<div class="grid">${shown.map(card).join('')}</div>` : '<p class="empty">Les premiers articles arrivent bientôt.</p>'}`;
  const head = jsonLd({
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url: canonical,
    mainEntity: { '@type': 'ItemList', itemListElement: shown.map((article, index) => ({ '@type': 'ListItem', position: index + 1, url: `${origin}/articles/${article.slug}`, name: article.title })) },
  });
  // A category page with no article is not worth indexing.
  return layout({ title, description, canonical, image: imageUrl(origin), type: 'website', body, head, noindex: Boolean(category && !shown.length) });
}

export function renderArticle(article: Article, related: ArticleSummary[], origin: string) {
  const url = `${origin}/articles/${article.slug}`;
  const title = `${metaTitle(article)} | ${SITE}`;
  const description = metaDescription(article);
  const image = imageUrl(origin, article.coverImageId);
  const minutes = readingMinutes(article.content);
  const updated = article.updatedAt && article.publishedAt && article.updatedAt.slice(0, 10) !== article.publishedAt.slice(0, 10);
  const body = `<p class="crumbs"><a href="/">Accueil</a> › <a href="/articles">Articles</a> › <a href="/articles?categorie=${encodeURIComponent(article.category)}">${e(article.category)}</a></p>
<article class="post">
<div class="hero"><span class="cat">${e(article.category)}</span><h1>${e(article.title)}</h1><p>${e(article.excerpt)}</p>
<p class="meta" style="margin-top:14px">Par ${e(article.authorName || 'L’équipe Haven')} · <time datetime="${e(article.publishedAt || article.updatedAt)}">${dateFr(article.publishedAt)}</time>${updated ? ` · mis à jour le <time datetime="${e(article.updatedAt)}">${dateFr(article.updatedAt)}</time>` : ''} · ${minutes} min de lecture</p></div>
${article.coverImageId ? `<img class="cover" src="/articles/images/${e(article.coverImageId)}" alt="${e(article.coverAlt || '')}" width="1200" height="675" fetchpriority="high">` : ''}
<div class="body">${markdownToHtml(article.content)}</div>
${article.tags.length ? `<ul class="tags" aria-label="Mots-clés">${article.tags.map(tag => `<li>${e(tag)}</li>`).join('')}</ul>` : ''}
<aside class="cta-box"><h2>Une chambre pour votre prochain séjour ?</h2><p>Des colocations vérifiées, de quelques nuits à plusieurs mois, au prix tout compris.</p><a href="/#/search">Trouver une chambre</a></aside>
</article>
${related.length ? `<section class="related" aria-labelledby="related-title"><h2 id="related-title">À lire aussi</h2><div class="grid">${related.map(card).join('')}</div></section>` : ''}`;
  const head = [
    `<meta property="article:published_time" content="${e(article.publishedAt || article.updatedAt)}">`,
    `<meta property="article:modified_time" content="${e(article.updatedAt)}">`,
    `<meta property="article:section" content="${e(article.category)}">`,
    ...article.tags.map(tag => `<meta property="article:tag" content="${e(tag)}">`),
    jsonLd({
      '@context': 'https://schema.org', '@type': 'BlogPosting', headline: article.title.slice(0, 110), description, image: [image],
      datePublished: article.publishedAt || article.updatedAt, dateModified: article.updatedAt, inLanguage: 'fr-FR',
      mainEntityOfPage: { '@type': 'WebPage', '@id': url }, articleSection: article.category, keywords: article.tags.join(', '),
      timeRequired: `PT${minutes}M`,
      author: { '@type': article.authorName ? 'Person' : 'Organization', name: article.authorName || SITE },
      publisher: { '@type': 'Organization', name: SITE, logo: { '@type': 'ImageObject', url: `${origin}/logo-600.png` } },
    }),
    jsonLd({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Articles', item: `${origin}/articles` },
        { '@type': 'ListItem', position: 3, name: article.title, item: url },
      ],
    }),
  ].join('\n');
  return layout({ title, description, canonical: url, image, type: 'article', body, head });
}

export function renderNotFound(origin: string) {
  return layout({ title: `Article introuvable | ${SITE}`, description: 'Cet article n’existe pas ou n’est plus en ligne.', canonical: `${origin}/articles`, image: imageUrl(origin), type: 'website', noindex: true,
    body: '<div class="hero"><h1>Article introuvable</h1><p>Cet article n’existe pas ou n’est plus en ligne.</p></div><p><a href="/articles">Voir tous les articles</a></p><p style="height:60px"></p>' });
}

const xml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Every indexable address: home, article list and each published article, with its last update. */
export function renderSitemap(list: Pick<Article, 'slug' | 'updatedAt' | 'coverImageId' | 'title'>[], origin: string) {
  const latest = list[0]?.updatedAt;
  const entry = (loc: string, lastmod?: string, extra = '') => `<url><loc>${xml(loc)}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}${extra}</url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entry(`${origin}/`)}
${entry(`${origin}/articles`, latest)}
${list.map(article => entry(`${origin}/articles/${article.slug}`, article.updatedAt,
    article.coverImageId ? `<image:image><image:loc>${xml(`${origin}/articles/images/${article.coverImageId}`)}</image:loc><image:title>${xml(article.title)}</image:title></image:image>` : '')).join('\n')}
</urlset>`;
}

export function renderFeed(list: Article[], origin: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Articles Haven</title>
<link>${origin}/articles</link>
<atom:link href="${origin}/articles/feed.xml" rel="self" type="application/rss+xml"/>
<description>Conseils colocation, stages, alternance et location de chambres meublées.</description>
<language>fr-FR</language>
${list.slice(0, 30).map(article => `<item><title>${xml(article.title)}</title><link>${origin}/articles/${article.slug}</link><guid isPermaLink="true">${origin}/articles/${article.slug}</guid><pubDate>${new Date(article.publishedAt || article.updatedAt).toUTCString()}</pubDate><category>${xml(article.category)}</category><description>${xml(metaDescription(article))}</description></item>`).join('\n')}
</channel>
</rss>`;
}

export function renderRobots(origin: string) {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

Sitemap: ${origin}/sitemap.xml
`;
}
