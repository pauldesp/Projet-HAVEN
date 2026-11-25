import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authenticatedFetch } from '../services/serverApi';
import type { ErrorGroup } from '../services/errorTracking';

const when = (value?: string) => value ? new Date(value).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/** Unexpected errors seen on the site and on the server, grouped; the team marks them resolved once fixed. */
export function AdminErrors() {
  const [errors, setErrors] = useState<ErrorGroup[] | null>(null);
  const [failed, setFailed] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [open, setOpen] = useState('');
  const load = useCallback(async () => {
    setFailed('');
    try {
      const response = await authenticatedFetch('/api/admin/errors');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Erreurs indisponibles.');
      setErrors(payload.errors);
    } catch (cause) { setFailed(cause instanceof Error ? cause.message : 'Erreurs indisponibles.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const resolve = async (id: string, resolved: boolean) => {
    try {
      const response = await authenticatedFetch(`/api/admin/errors/${encodeURIComponent(id)}/resolve`, { method: 'POST', body: JSON.stringify({ resolved }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Action impossible.');
      await load();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Action impossible.'); }
  };

  const visible = (errors || []).filter(item => showResolved || item.status === 'OPEN');
  const openCount = (errors || []).filter(item => item.status === 'OPEN').length;
  return <section className="space-y-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="font-bold text-haven-ink">Erreurs de l’application {openCount > 0 && <span className="ml-1 rounded-full bg-haven-red px-2 py-0.5 text-xs text-white">{openCount}</span>}</h3>
        <p className="text-sm text-gray-500">Erreurs imprévues sur le site (navigateurs des visiteurs) et sur le serveur, regroupées. En ligne, la première apparition d’une erreur envoie une alerte à l’équipe. Aucune donnée personnelle n’est conservée.</p>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={showResolved} onChange={event => setShowResolved(event.target.checked)} /> Afficher les résolues</label>
    </div>
    {failed && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{failed}</p>}
    <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
      {visible.map(item => <li key={item.id} className="p-4 text-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <button type="button" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? '' : item.id)} className="min-w-0 text-left">
            <p className="font-semibold text-haven-ink"><span className={item.status === 'OPEN' ? 'text-haven-red' : 'text-green-700'}>{item.status === 'OPEN' ? 'À traiter' : 'Résolue'}</span> · {item.source === 'CLIENT' ? 'Site' : 'Serveur'} · {item.count} fois</p>
            <p className="break-words text-gray-700">{item.message}</p>
            <p className="text-xs text-gray-400">Dernière : {when(item.lastAt)} · première : {when(item.firstAt)}{item.path ? ` · ${item.path}` : ''}{item.browser ? ` · ${item.browser}` : ''}{item.context ? ` · ${item.context}` : ''}</p>
          </button>
          <button type="button" onClick={() => void resolve(item.id, item.status === 'OPEN')} className="min-h-11 shrink-0 rounded-xl border border-gray-200 px-3 font-semibold text-haven-ink">{item.status === 'OPEN' ? 'Marquer résolue' : 'Rouvrir'}</button>
        </div>
        {open === item.id && item.stack && <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-gray-50 p-3 text-xs text-gray-600">{item.stack}</pre>}
      </li>)}
      {errors && !visible.length && <li className="p-8 text-center text-sm text-gray-500">Aucune erreur {showResolved ? 'enregistrée' : 'à traiter'}.</li>}
      {!errors && !failed && <li className="p-8 text-center text-sm text-gray-500">Chargement…</li>}
    </ul>
  </section>;
}
