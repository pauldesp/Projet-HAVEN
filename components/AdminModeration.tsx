import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Search, Star } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../firebase';
import type { Listing, Review, User } from '../types';
import { authenticatedFetch } from '../services/serverApi';

const post = async (path: string, body: unknown) => {
  const response = await authenticatedFetch(path, { method: 'POST', body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Action impossible.');
};

/** Suspend or restore listings, correct them, hide or restore reviews. */
export function AdminModeration({ listings, users }: { listings: Listing[]; users: User[] }) {
  const [section, setSection] = useState<'LISTINGS' | 'REVIEWS'>('LISTINGS');
  const [search, setSearch] = useState('');
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [busy, setBusy] = useState('');
  const loadReviews = useCallback(async () => {
    const snapshot = await getDocs(collection(db, 'reviews'));
    setReviews(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Review).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, []);
  useEffect(() => { if (section === 'REVIEWS' && !reviews) void loadReviews().catch(() => toast.error('Avis indisponibles.')); }, [section, reviews, loadReviews]);

  const name = (id: string) => { const user = users.find(item => item.id === id); return user ? `${user.firstName} ${user.lastName}` : `Compte ${id.slice(0, 8)}`; };
  const matches = (value: string) => !search.trim() || value.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr'));
  const shown = useMemo(() => listings.filter(listing => (listing.status === 'APPROVED' || listing.suspendedByHaven) && matches(`${listing.title} ${listing.city} ${name(listing.ownerId)}`)), [listings, search, users]);
  const shownReviews = (reviews || []).filter(review => matches(`${review.comment} ${review.authorName || ''} ${listings.find(item => item.id === review.targetId)?.title || ''}`));

  const act = async (key: string, path: string, body: unknown, success: string, after?: () => Promise<void>) => {
    setBusy(key);
    try { await post(path, body); toast.success(success); await after?.(); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Action impossible.'); }
    finally { setBusy(''); }
  };
  const askReason = (question: string) => { const value = window.prompt(question); return value && value.trim().length >= 3 ? value.trim() : null; };

  return <section className="space-y-5">
    <div>
      <h2 className="text-xl font-bold text-haven-navy">Modération</h2>
      <p className="mt-1 text-sm text-gray-500">Suspendre une annonce sans la supprimer, la corriger, masquer un avis abusif. Chaque action est inscrite au journal.</p>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex gap-2">
        {(['LISTINGS', 'REVIEWS'] as const).map(value => <button key={value} type="button" aria-pressed={section === value} onClick={() => setSection(value)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${section === value ? 'border-haven-navy bg-haven-navy text-white' : 'border-gray-200 text-haven-navy'}`}>{value === 'LISTINGS' ? 'Annonces en ligne' : 'Avis'}</button>)}
      </div>
      <label className="relative block flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <span className="sr-only">Rechercher</span>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher…" className="h-11 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm" />
      </label>
    </div>

    {section === 'LISTINGS' && <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
      {shown.map(listing => <li key={listing.id} className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-haven-navy">{listing.title} · {listing.city}</p>
          <p className="text-xs text-gray-500">Propriétaire : {name(listing.ownerId)} · {listing.suspendedByHaven ? <span className="text-haven-red">suspendue</span> : 'en ligne'}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link to={`/listing/${listing.id}`} className="flex min-h-11 items-center rounded-xl border border-gray-200 px-3 font-semibold text-haven-navy">Voir</Link>
          <Link to={`/owner/edit/${listing.id}`} className="flex min-h-11 items-center rounded-xl border border-gray-200 px-3 font-semibold text-haven-navy">Corriger</Link>
          {listing.suspendedByHaven
            ? <button type="button" disabled={busy === listing.id} onClick={() => void act(listing.id, `/api/admin/listings/${listing.id}/suspend`, { suspend: false }, 'Annonce remise en ligne.')} className="min-h-11 rounded-xl border border-green-200 px-3 font-semibold text-green-700">Remettre en ligne</button>
            : <button type="button" disabled={busy === listing.id} onClick={() => { const reason = askReason('Motif de la suspension (visible par le propriétaire)'); if (reason) void act(listing.id, `/api/admin/listings/${listing.id}/suspend`, { suspend: true, reason }, 'Annonce suspendue.'); }} className="min-h-11 rounded-xl border border-red-100 px-3 font-semibold text-haven-red">Suspendre</button>}
        </div>
      </li>)}
      {!shown.length && <li className="p-8 text-center text-sm text-gray-500">Aucune annonce.</li>}
    </ul>}

    {section === 'REVIEWS' && (!reviews ? <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Chargement des avis…</p> : <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
      {shownReviews.map(review => <li key={review.id} className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1 font-semibold text-haven-navy"><Star size={14} className="fill-haven-red text-haven-red" aria-hidden="true" />{review.rating}/5 · {review.targetType === 'LISTING' ? listings.find(item => item.id === review.targetId)?.title || 'Logement' : name(review.targetId)}{review.hiddenByHaven && <span className="ml-1 text-haven-red">· masqué</span>}</p>
          <p className="mt-1 whitespace-pre-wrap text-gray-600">{review.comment || 'Sans commentaire.'}</p>
          <p className="mt-1 text-xs text-gray-400">Par {review.authorName || name(review.authorId)} · {new Date(review.createdAt).toLocaleDateString('fr-FR')}{review.hiddenReason ? ` · motif : ${review.hiddenReason}` : ''}</p>
        </div>
        {review.hiddenByHaven
          ? <button type="button" disabled={busy === review.id} onClick={() => void act(review.id, `/api/admin/reviews/${review.id}/hide`, { hide: false }, 'Avis de nouveau visible.', loadReviews)} className="min-h-11 shrink-0 rounded-xl border border-green-200 px-3 font-semibold text-green-700">Rendre visible</button>
          : <button type="button" disabled={busy === review.id} onClick={() => { const reason = askReason('Motif du masquage (insulte, hors sujet, données personnelles…)'); if (reason) void act(review.id, `/api/admin/reviews/${review.id}/hide`, { hide: true, reason }, 'Avis masqué, note recalculée.', loadReviews); }} className="min-h-11 shrink-0 rounded-xl border border-red-100 px-3 font-semibold text-haven-red">Masquer</button>}
      </li>)}
      {!shownReviews.length && <li className="p-8 text-center text-sm text-gray-500">Aucun avis.</li>}
    </ul>)}
  </section>;
}
