import { markdownToText, slugify } from './markdown';

/** Blog articles of Haven: written in the back office, published as real, crawlable pages under /articles. */
export type ArticleStatus = 'DRAFT' | 'PUBLISHED';
export interface Article {
  id: string;
  slug: string;
  title: string;
  /** Short summary shown on the list and used as the default meta description. */
  excerpt: string;
  /** Markdown body. */
  content: string;
  category: string;
  tags: string[];
  coverImageId?: string;
  coverAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
  status: ArticleStatus;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}
export type ArticleInput = Pick<Article, 'title' | 'slug' | 'excerpt' | 'content' | 'category' | 'tags' | 'coverImageId' | 'coverAlt' | 'seoTitle' | 'seoDescription' | 'status'>;
export type ArticleSummary = Pick<Article, 'id' | 'slug' | 'title' | 'excerpt' | 'category' | 'coverImageId' | 'coverAlt' | 'publishedAt' | 'updatedAt'> & { readingMinutes: number };

export const ARTICLE_CATEGORIES = ['Conseils locataires', 'Conseils propriétaires', 'Colocation', 'Stages et alternance', 'Villes', 'Actualités Haven'] as const;

export const wordCount = (markdown: string) => markdownToText(markdown).split(/\s+/).filter(Boolean).length;
/** About 220 words a minute, at least one minute. */
export const readingMinutes = (markdown: string) => Math.max(1, Math.round(wordCount(markdown) / 220));

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';

/** Validates and normalises what the admin sends; throws a French message for the editor. */
export function prepareArticleInput(input: Partial<ArticleInput> | null | undefined): ArticleInput {
  if (!input || typeof input !== 'object') throw new Error('Article invalide.');
  const title = clean(input.title, 140);
  if (title.length < 5) throw new Error('Donnez un titre d’au moins 5 caractères.');
  const slug = slugify(clean(input.slug, 120) || title);
  if (slug.length < 3) throw new Error('L’adresse de l’article est trop courte.');
  const content = typeof input.content === 'string' ? input.content.replace(/\r/g, '').trim().slice(0, 60_000) : '';
  const status: ArticleStatus = input.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
  if (status === 'PUBLISHED' && wordCount(content) < 50) throw new Error('Un article publié doit contenir au moins 50 mots.');
  const category = (ARTICLE_CATEGORIES as readonly string[]).includes(String(input.category)) ? String(input.category) : ARTICLE_CATEGORIES[0];
  const tags = Array.isArray(input.tags) ? [...new Set(input.tags.map(tag => clean(tag, 30)).filter(Boolean))].slice(0, 8) : [];
  const coverImageId = typeof input.coverImageId === 'string' && /^[a-zA-Z0-9_-]{6,64}$/.test(input.coverImageId) ? input.coverImageId : undefined;
  return {
    title, slug, content, status, category, tags, coverImageId,
    excerpt: clean(input.excerpt, 300) || markdownToText(content).slice(0, 200),
    coverAlt: clean(input.coverAlt, 160) || undefined,
    seoTitle: clean(input.seoTitle, 70) || undefined,
    seoDescription: clean(input.seoDescription, 170) || undefined,
  };
}

export const metaTitle = (article: Pick<Article, 'title' | 'seoTitle'>) => article.seoTitle || article.title;
export const metaDescription = (article: Pick<Article, 'excerpt' | 'seoDescription' | 'content'>) =>
  (article.seoDescription || article.excerpt || markdownToText(article.content)).slice(0, 160);

export type SeoCheck = { label: string; ok: boolean; advice: string };

/** Live checklist for the editor: the points that matter most for search engines. */
export function seoChecklist(article: Partial<ArticleInput>): SeoCheck[] {
  const title = metaTitle({ title: article.title || '', seoTitle: article.seoTitle });
  const description = metaDescription({ excerpt: article.excerpt || '', seoDescription: article.seoDescription, content: article.content || '' });
  const words = wordCount(article.content || '');
  const headings = (article.content || '').match(/^#{2,3}\s+\S/gm)?.length || 0;
  const links = (article.content || '').match(/\]\((?:\/|https?:\/\/)/g)?.length || 0;
  const keyword = (article.tags || [])[0]?.toLocaleLowerCase('fr');
  return [
    { label: 'Titre pour Google', ok: title.length >= 30 && title.length <= 60, advice: `${title.length} caractères : visez 30 à 60 pour ne pas être coupé.` },
    { label: 'Description pour Google', ok: description.length >= 120 && description.length <= 160, advice: `${description.length} caractères : visez 120 à 160.` },
    { label: 'Longueur du texte', ok: words >= 600, advice: `${words} mots : au moins 600 mots pour bien se positionner.` },
    { label: 'Intertitres', ok: headings >= 2, advice: `${headings} intertitre(s) : structurez le texte avec au moins 2 intertitres (##).` },
    { label: 'Image de couverture', ok: Boolean(article.coverImageId && article.coverAlt), advice: 'Ajoutez une image de couverture et sa description (texte alternatif).' },
    { label: 'Liens', ok: links >= 1, advice: 'Ajoutez au moins un lien, idéalement vers une page Haven (ex. : /#/search).' },
    { label: 'Mot-clé principal', ok: Boolean(keyword && title.toLocaleLowerCase('fr').includes(keyword)), advice: keyword ? `Le premier mot-clé « ${keyword} » devrait figurer dans le titre.` : 'Ajoutez un mot-clé principal (premier mot-clé).' },
  ];
}
