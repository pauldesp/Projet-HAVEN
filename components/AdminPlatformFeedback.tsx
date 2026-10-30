import { useEffect, useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { authenticatedFetch } from '../services/serverApi';
import type { PlatformFeedback } from '../services/platformFeedback';

export function AdminPlatformFeedback() {
  const [feedback, setFeedback] = useState<PlatformFeedback[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true; setBusy(true); setError('');
    void authenticatedFetch('/api/admin/platform-feedback').then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (active) { setFeedback(data.feedback); setCursor(data.nextCursor); }
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [refresh]);
  const loadMore = async () => {
    if (!cursor || busy) return;
    setBusy(true); setError('');
    try {
      const response = await authenticatedFetch(`/api/admin/platform-feedback?cursor=${encodeURIComponent(cursor)}`);
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setFeedback(current => [...current, ...data.feedback]); setCursor(data.nextCursor);
    } catch (error) { setError(error instanceof Error ? error.message : 'Chargement impossible.'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-heading text-2xl font-bold text-haven-navy">Avis sur la plateforme Haven</h2><p className="mt-2 text-sm text-gray-500">Retours privés des locataires pour faire évoluer la plateforme. Ils ne sont pas publiés sur les annonces et n’influencent pas leur note.</p></div><button disabled={busy} type="button" onClick={() => setRefresh(value => value + 1)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold disabled:opacity-50">Actualiser</button></div>
    {feedback.map(item => <article key={item.id} className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-haven-navy"><Star size={17} className="fill-yellow-400 text-yellow-400" /><strong>{item.rating}/5</strong><span className="text-sm text-gray-500">{item.authorName}</span></div><time className="text-xs text-gray-400" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString('fr-FR')}</time></div>
      {item.comment && <p className="whitespace-pre-line break-words text-sm leading-relaxed text-gray-600">{item.comment}</p>}
      <p className="break-all text-xs text-gray-400">Réservation : {item.bookingId}</p>
    </article>)}
    {!busy && !error && !feedback.length && <p className="py-10 text-center text-gray-400">Aucun retour sur Haven pour le moment.</p>}
    {busy && <p role="status" className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={18} className="animate-spin" />Chargement des avis…</p>}
    {error && <p role="alert" className="text-sm text-haven-red">{error}</p>}
    {cursor && <button type="button" disabled={busy} onClick={() => void loadMore()} className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold disabled:opacity-50">Afficher les avis suivants</button>}
  </section>;
}
