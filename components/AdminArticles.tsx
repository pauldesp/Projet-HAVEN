import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bold, CheckCircle2, CircleAlert, ExternalLink, Eye, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Pencil, Plus, Quote, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { authenticatedFetch } from '../services/serverApi';
import { ARTICLE_CATEGORIES, metaDescription, metaTitle, readingMinutes, seoChecklist, wordCount, type Article, type ArticleInput } from '../services/articles';
import { markdownToHtml, slugify } from '../services/markdown';

type Draft = ArticleInput & { id?: string; tagsText: string; slugEdited: boolean };
const EMPTY: Draft = { title: '', slug: '', excerpt: '', content: '', category: ARTICLE_CATEGORIES[0], tags: [], coverImageId: undefined, coverAlt: '', seoTitle: '', seoDescription: '', status: 'DRAFT', tagsText: '', slugEdited: false };
const when = (value?: string) => value ? new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const field = 'mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-haven-navy focus:border-haven-navy focus:outline-none';

/** Resizes an image in the browser to a web-friendly WebP (JPEG if WebP is unavailable) under 850 KB. */
async function optimizeImage(file: File): Promise<string> {
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image illisible.'));
    image.src = URL.createObjectURL(file);
  });
  const probe = document.createElement('canvas');
  const format = probe.toDataURL('image/webp').startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
  for (const max of [1600, 1280, 1024]) {
    const scale = Math.min(1, max / Math.max(source.naturalWidth, source.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(source.naturalWidth * scale); canvas.height = Math.round(source.naturalHeight * scale);
    canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.72, 0.6]) {
      const dataUrl = canvas.toDataURL(format, quality);
      if (dataUrl.length * 0.75 < 850 * 1024) { URL.revokeObjectURL(source.src); return dataUrl; }
    }
  }
  URL.revokeObjectURL(source.src);
  throw new Error('Image trop lourde, même après optimisation.');
}

async function uploadImage(file: File) {
  const dataUrl = await optimizeImage(file);
  const response = await authenticatedFetch('/api/admin/article-images', { method: 'POST', body: JSON.stringify({ dataUrl }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Envoi de l’image impossible.');
  return data as { id: string; url: string };
}

function Counter({ value, min, max }: { value: number; min: number; max: number }) {
  return <span className={`text-xs ${value >= min && value <= max ? 'text-green-700' : 'text-amber-700'}`}>{value} / {max}</span>;
}

/** Back-office blog: write, illustrate, optimise for search engines and publish articles without code. */
export function AdminArticles() {
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<'WRITE' | 'PREVIEW'>('WRITE');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await authenticatedFetch('/api/admin/articles');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Articles indisponibles.');
      setArticles(data.articles);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Articles indisponibles.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const edit = (article?: Article) => {
    setTab('WRITE');
    setDraft(article ? { ...EMPTY, ...article, coverAlt: article.coverAlt || '', seoTitle: article.seoTitle || '', seoDescription: article.seoDescription || '', tagsText: article.tags.join(', '), slugEdited: true } : { ...EMPTY });
  };
  const update = (patch: Partial<Draft>) => setDraft(previous => {
    if (!previous) return previous;
    const next = { ...previous, ...patch };
    // The address follows the title until it is edited by hand (and never changes once published).
    if ('title' in patch && !previous.slugEdited && previous.status !== 'PUBLISHED') next.slug = slugify(patch.title || '');
    return next;
  });

  const input = useMemo<Partial<ArticleInput>>(() => draft ? { ...draft, tags: draft.tagsText.split(',').map(tag => tag.trim()).filter(Boolean) } : {}, [draft]);
  const checks = useMemo(() => draft ? seoChecklist(input) : [], [draft, input]);
  const preview = useMemo(() => draft && tab === 'PREVIEW' ? markdownToHtml(draft.content) : '', [draft, tab]);

  const save = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const body = JSON.stringify({ ...input, status });
      const response = await authenticatedFetch(draft.id ? `/api/admin/articles/${draft.id}` : '/api/admin/articles', { method: draft.id ? 'PUT' : 'POST', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Enregistrement impossible.');
      const saved = data as Article;
      setDraft(previous => previous && { ...previous, id: saved.id, slug: saved.slug, status: saved.status, slugEdited: true });
      toast.success(status === 'PUBLISHED' ? 'Article publié : il est en ligne et dans le plan du site.' : 'Brouillon enregistré.');
      void load();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  };

  const remove = async (article: Article) => {
    if (!window.confirm(`Supprimer définitivement « ${article.title} » ?`)) return;
    try {
      const response = await authenticatedFetch(`/api/admin/articles/${article.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Suppression impossible.');
      toast.success('Article supprimé.');
      void load();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Suppression impossible.'); }
  };

  /** Wraps the selection (or inserts at the cursor) with Markdown, like a text editor's buttons. */
  const format = (before: string, after = '', placeholder = 'texte') => {
    const element = textarea.current;
    if (!element || !draft) return;
    const { selectionStart: start, selectionEnd: end, value } = element;
    const selected = value.slice(start, end) || placeholder;
    const lineStart = before.endsWith(' ') && !after ? value.lastIndexOf('\n', start - 1) + 1 : start;
    const next = before.endsWith(' ') && !after
      ? value.slice(0, lineStart) + before + value.slice(lineStart)
      : value.slice(0, start) + before + selected + after + value.slice(end);
    update({ content: next });
    requestAnimationFrame(() => { element.focus(); const cursor = before.endsWith(' ') && !after ? end + before.length : start + before.length + selected.length + after.length; element.setSelectionRange(cursor, cursor); });
  };
  const insertLink = () => {
    const url = window.prompt('Adresse du lien (ex. : /#/search ou https://…)');
    if (url) format('[', `](${url.trim()})`, 'texte du lien');
  };
  const insertImage = async (file?: File) => {
    if (!file) return;
    setUploading('content');
    try {
      const { url } = await uploadImage(file);
      const alt = window.prompt('Décrivez l’image en quelques mots (important pour Google et l’accessibilité)') || '';
      format(`\n\n![${alt}](${url})\n\n`, '', '');
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Image non envoyée.'); }
    finally { setUploading(''); }
  };
  const uploadCover = async (file?: File) => {
    if (!file) return;
    setUploading('cover');
    try { const { id } = await uploadImage(file); update({ coverImageId: id }); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Image non envoyée.'); }
    finally { setUploading(''); }
  };

  if (error) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!articles) return <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Chargement des articles…</p>;

  if (!draft) return <section className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-bold text-haven-navy">Articles</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">Rédigez des articles de conseils : publiés sur <a href="/articles" target="_blank" rel="noopener" className="font-semibold underline">/articles</a>, ils sont lisibles par Google, ajoutés au plan du site et au flux RSS automatiquement.</p>
      </div>
      <button type="button" onClick={() => edit()} className="flex min-h-11 items-center gap-2 self-start rounded-xl bg-haven-navy px-4 text-sm font-bold text-white"><Plus size={16} /> Nouvel article</button>
    </div>
    <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
      {articles.map(article => <li key={article.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-haven-navy"><span className={`mr-2 rounded-full px-2 py-0.5 text-xs ${article.status === 'PUBLISHED' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{article.status === 'PUBLISHED' ? 'En ligne' : 'Brouillon'}</span>{article.title}</p>
          <p className="mt-1 text-xs text-gray-500">{article.category} · {wordCount(article.content)} mots · modifié le {when(article.updatedAt)}{article.publishedAt ? ` · publié le ${when(article.publishedAt)}` : ''}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {article.status === 'PUBLISHED' && <a href={`/articles/${article.slug}`} target="_blank" rel="noopener" className="flex min-h-11 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-haven-navy"><ExternalLink size={15} /> Voir</a>}
          <button type="button" onClick={() => edit(article)} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-haven-navy"><Pencil size={15} /> Modifier</button>
          <button type="button" onClick={() => void remove(article)} aria-label={`Supprimer ${article.title}`} className="flex min-h-11 items-center rounded-xl border border-red-100 px-3 text-haven-red"><Trash2 size={15} /></button>
        </div>
      </li>)}
      {!articles.length && <li className="p-8 text-center text-sm text-gray-500">Aucun article pour l’instant. Créez le premier !</li>}
    </ul>
  </section>;

  const title = metaTitle({ title: draft.title, seoTitle: draft.seoTitle });
  const description = metaDescription({ excerpt: draft.excerpt, seoDescription: draft.seoDescription, content: draft.content });
  const tools: [React.ElementType, string, () => void][] = [
    [Heading2, 'Intertitre', () => format('## ')], [Heading3, 'Sous-titre', () => format('### ')], [Bold, 'Gras', () => format('**', '**')],
    [Italic, 'Italique', () => format('*', '*')], [List, 'Liste', () => format('- ')], [ListOrdered, 'Liste numérotée', () => format('1. ')],
    [Quote, 'Citation', () => format('> ')], [Link2, 'Lien', insertLink],
  ];

  return <section className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" onClick={() => { setDraft(null); void load(); }} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-gray-600"><ArrowLeft size={16} /> Tous les articles</button>
      <div className="flex flex-wrap gap-2">
        {draft.status === 'PUBLISHED' && draft.id && <a href={`/articles/${draft.slug}`} target="_blank" rel="noopener" className="flex min-h-11 items-center gap-1.5 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-haven-navy"><ExternalLink size={15} /> Voir en ligne</a>}
        {draft.status === 'PUBLISHED'
          ? <button type="button" disabled={saving} onClick={() => void save('DRAFT')} className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-haven-navy">Retirer du site</button>
          : <button type="button" disabled={saving} onClick={() => void save('DRAFT')} className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-haven-navy">Enregistrer le brouillon</button>}
        <button type="button" disabled={saving} onClick={() => void save('PUBLISHED')} className="flex min-h-11 items-center gap-2 rounded-xl bg-haven-red px-5 text-sm font-bold text-white disabled:opacity-50">
          {saving && <Loader2 size={16} className="animate-spin" />}{draft.status === 'PUBLISHED' ? 'Mettre à jour' : 'Publier'}
        </button>
      </div>
    </div>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-5 sm:p-6">
        <label className="block text-sm font-semibold text-haven-navy">Titre
          <input value={draft.title} onChange={event => update({ title: event.target.value })} placeholder="Ex. : Trouver une colocation à Lyon pour son stage" className={`${field} text-lg font-semibold`} maxLength={140} />
        </label>
        <label className="block text-sm font-semibold text-haven-navy">Adresse de la page
          <div className="mt-1 flex items-center rounded-xl border border-gray-200 bg-gray-50 pl-3 text-sm text-gray-500 focus-within:border-haven-navy">
            <span className="shrink-0">/articles/</span>
            <input value={draft.slug} disabled={draft.status === 'PUBLISHED'} onChange={event => update({ slug: slugify(event.target.value), slugEdited: true })} className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-haven-navy focus:outline-none disabled:text-gray-500" />
          </div>
          <span className="mt-1 block text-xs font-normal text-gray-400">{draft.status === 'PUBLISHED' ? 'Fixée une fois l’article publié, pour ne pas casser les liens et le référencement.' : 'Courte, avec les mots-clés principaux. Créée automatiquement à partir du titre.'}</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-haven-navy">Catégorie
            <select value={draft.category} onChange={event => update({ category: event.target.value })} className={field}>{ARTICLE_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select>
          </label>
          <label className="block text-sm font-semibold text-haven-navy">Mots-clés <span className="font-normal text-gray-400">(séparés par des virgules, le principal en premier)</span>
            <input value={draft.tagsText} onChange={event => update({ tagsText: event.target.value })} placeholder="colocation lyon, stage, logement étudiant" className={field} />
          </label>
        </div>
        <label className="block text-sm font-semibold text-haven-navy">Résumé <span className="font-normal text-gray-400">(affiché sous le titre et dans la liste des articles)</span>
          <textarea value={draft.excerpt} onChange={event => update({ excerpt: event.target.value })} rows={2} maxLength={300} className={field} />
        </label>

        <div>
          <p className="text-sm font-semibold text-haven-navy">Image de couverture</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
            <label className="flex aspect-video w-full shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 sm:w-56">
              {uploading === 'cover' ? <Loader2 className="animate-spin" /> : draft.coverImageId ? <img src={`/articles/images/${draft.coverImageId}`} alt="" className="h-full w-full object-cover" /> : <span className="flex items-center gap-2"><Upload size={16} /> Choisir une image</span>}
              <input type="file" accept="image/*" className="sr-only" onChange={event => { void uploadCover(event.target.files?.[0]); event.target.value = ''; }} />
            </label>
            <label className="block flex-1 text-sm font-semibold text-haven-navy">Description de l’image
              <input value={draft.coverAlt} onChange={event => update({ coverAlt: event.target.value })} placeholder="Ex. : salon lumineux d’une colocation à Lyon" maxLength={160} className={field} />
              <span className="mt-1 block text-xs font-normal text-gray-400">Lue par Google Images et les lecteurs d’écran. L’image est redimensionnée et allégée automatiquement.</span>
            </label>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-haven-navy">Contenu</p>
            <div className="flex rounded-full border border-gray-200 p-0.5 text-sm">
              {(['WRITE', 'PREVIEW'] as const).map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${tab === value ? 'bg-haven-navy text-white' : 'text-gray-600'}`}>{value === 'WRITE' ? <><Pencil size={14} /> Écrire</> : <><Eye size={14} /> Aperçu</>}</button>)}
            </div>
          </div>
          {tab === 'WRITE' ? <>
            <div className="mt-2 flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-gray-200 bg-gray-50 p-1.5">
              {tools.map(([Icon, label, action]) => <button key={label} type="button" title={label} aria-label={label} onClick={action} className="flex h-9 w-9 items-center justify-center rounded-lg text-haven-navy hover:bg-white"><Icon size={17} /></button>)}
              <label title="Insérer une image" className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm text-haven-navy hover:bg-white">
                {uploading === 'content' ? <Loader2 size={17} className="animate-spin" /> : <ImagePlus size={17} />}<span className="hidden sm:inline">Image</span>
                <input type="file" accept="image/*" className="sr-only" onChange={event => { void insertImage(event.target.files?.[0]); event.target.value = ''; }} />
              </label>
            </div>
            <textarea ref={textarea} value={draft.content} onChange={event => update({ content: event.target.value })} rows={22}
              placeholder={'Écrivez votre article ici.\n\n## Un intertitre\n\nUn paragraphe avec du **gras** et un [lien vers la recherche](/#/search).\n\n- un point\n- un autre point'}
              className="w-full rounded-b-xl border border-gray-200 bg-white p-4 font-mono text-sm leading-relaxed text-haven-navy focus:border-haven-navy focus:outline-none" />
            <p className="mt-1 text-xs text-gray-400">{wordCount(draft.content)} mots · {readingMinutes(draft.content)} min de lecture. Les boutons ajoutent la mise en forme ; « ## » crée un intertitre.</p>
          </> : <div className="prose prose-slate mt-2 max-w-none rounded-xl border border-gray-200 bg-white p-5 prose-headings:font-heading prose-headings:text-haven-navy prose-a:text-haven-red" dangerouslySetInnerHTML={{ __html: preview || '<p>Rien à afficher pour l’instant.</p>' }} />}
        </div>
      </div>

      <aside className="space-y-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <h3 className="font-bold text-haven-navy">Aperçu dans Google</h3>
          <div className="mt-3 rounded-xl bg-gray-50 p-3">
            <p className="truncate text-xs text-gray-500">havencoloc.fr › articles › {draft.slug || '…'}</p>
            <p className="mt-1 line-clamp-2 text-[17px] leading-snug text-[#1a0dab]">{title || 'Titre de l’article'} | Haven</p>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-gray-600">{description || 'La description apparaîtra ici.'}</p>
          </div>
          <label className="mt-4 block text-sm font-semibold text-haven-navy">
            <span className="flex justify-between">Titre pour Google <Counter value={title.length} min={30} max={60} /></span>
            <input value={draft.seoTitle} onChange={event => update({ seoTitle: event.target.value })} placeholder={draft.title || 'Par défaut : le titre'} maxLength={70} className={field} />
          </label>
          <label className="mt-3 block text-sm font-semibold text-haven-navy">
            <span className="flex justify-between">Description pour Google <Counter value={description.length} min={120} max={160} /></span>
            <textarea value={draft.seoDescription} onChange={event => update({ seoDescription: event.target.value })} placeholder="Par défaut : le résumé" rows={3} maxLength={170} className={field} />
          </label>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <h3 className="font-bold text-haven-navy">Référencement : {checks.filter(check => check.ok).length} / {checks.length}</h3>
          <ul className="mt-3 space-y-2.5">
            {checks.map(check => <li key={check.label} className="flex gap-2 text-sm">
              {check.ok ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-green-600" aria-label="Validé" /> : <CircleAlert size={17} className="mt-0.5 shrink-0 text-amber-600" aria-label="À améliorer" />}
              <span><span className="font-semibold text-haven-navy">{check.label}</span><span className="block text-xs text-gray-500">{check.advice}</span></span>
            </li>)}
          </ul>
        </div>
      </aside>
    </div>
  </section>;
}
