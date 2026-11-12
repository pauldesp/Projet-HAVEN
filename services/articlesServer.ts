import { randomBytes } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { prepareArticleInput, readingMinutes, type Article, type ArticleSummary } from './articles';

export class ArticleError extends Error { constructor(message: string, public status = 422) { super(message); } }

const MAX_IMAGE_BYTES = 900 * 1024; // a Firestore document holds 1 MB
const IMAGE = /^data:(image\/(?:webp|jpeg|png|avif));base64,([A-Za-z0-9+/=]+)$/;
const newId = () => randomBytes(9).toString('base64url');

export const toSummary = (article: Article): ArticleSummary => ({
  id: article.id, slug: article.slug, title: article.title, excerpt: article.excerpt, category: article.category,
  coverImageId: article.coverImageId, coverAlt: article.coverAlt, publishedAt: article.publishedAt, updatedAt: article.updatedAt,
  readingMinutes: readingMinutes(article.content),
});

/** Articles and their images, stored in Firestore and only written by the server (admins). */
export function createArticles(db: Firestore) {
  const articles = db.collection('articles');
  const images = db.collection('article_images');
  // Published articles change rarely: a short in-memory cache keeps pages fast.
  let cache: { at: number; list: Article[] } | null = null;
  const invalidate = () => { cache = null; };

  async function published(): Promise<Article[]> {
    if (cache && Date.now() - cache.at < 60_000) return cache.list;
    const snapshot = await articles.where('status', '==', 'PUBLISHED').get();
    const list = snapshot.docs.map(doc => doc.data() as Article).sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
    cache = { at: Date.now(), list };
    return list;
  }

  async function bySlug(slug: string) {
    return (await published()).find(article => article.slug === slug) || null;
  }

  async function all(): Promise<Article[]> {
    const snapshot = await articles.get();
    return snapshot.docs.map(doc => doc.data() as Article).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  /** Creates (no id) or updates an article. The address stays unique; a published one keeps its date. */
  async function save(id: string | null, input: unknown, authorName: string): Promise<Article> {
    let data;
    try { data = prepareArticleInput(input as never); } catch (error) { throw new ArticleError(error instanceof Error ? error.message : 'Article invalide.'); }
    const ref = id ? articles.doc(id) : articles.doc(newId());
    const saved = await db.runTransaction(async transaction => {
      const [current, sameSlug] = await Promise.all([transaction.get(ref), transaction.get(articles.where('slug', '==', data.slug))]);
      if (id && !current.exists) throw new ArticleError('Article introuvable.', 404);
      if (sameSlug.docs.some(doc => doc.id !== ref.id)) throw new ArticleError('Un autre article utilise déjà cette adresse. Modifiez-la.', 409);
      const previous = current.data() as Article | undefined;
      const at = new Date().toISOString();
      const article: Article = {
        ...data, id: ref.id, authorName: previous?.authorName || authorName, createdAt: previous?.createdAt || at, updatedAt: at,
        ...(data.status === 'PUBLISHED' ? { publishedAt: previous?.publishedAt || at } : previous?.publishedAt ? { publishedAt: previous.publishedAt } : {}),
      };
      // Firestore refuses undefined values.
      transaction.set(ref, Object.fromEntries(Object.entries(article).filter(([, value]) => value !== undefined)));
      return article;
    });
    invalidate();
    return saved;
  }

  async function remove(id: string) {
    const ref = articles.doc(id);
    if (!(await ref.get()).exists) throw new ArticleError('Article introuvable.', 404);
    await ref.delete();
    invalidate();
  }

  async function saveImage(dataUrl: unknown) {
    const match = typeof dataUrl === 'string' ? dataUrl.match(IMAGE) : null;
    if (!match) throw new ArticleError('Image invalide : formats acceptés WebP, JPEG, PNG ou AVIF.');
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > MAX_IMAGE_BYTES) throw new ArticleError('Image trop lourde : 900 Ko au maximum.');
    const id = newId();
    await images.doc(id).set({ id, contentType: match[1], data: match[2], size: bytes.length, createdAt: new Date().toISOString() });
    return { id, url: `/articles/images/${id}` };
  }

  async function image(id: string) {
    if (!/^[a-zA-Z0-9_-]{6,64}$/.test(id)) return null;
    const saved = (await images.doc(id).get()).data();
    return saved ? { contentType: String(saved.contentType), bytes: Buffer.from(String(saved.data), 'base64') } : null;
  }

  return { published, bySlug, all, save, remove, saveImage, image };
}
