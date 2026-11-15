import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { DamageClaim } from '../types';
import { authenticatedFetch } from '../services/serverApi';
import { formatEuros } from '../services/money';
import { DAMAGE_DEPOSIT_POLICY, DAMAGE_STATUS_LABELS, canChargeDamageClaim, damageResponseDeadline } from '../services/damageDeposit';

const call = async (path: string, body?: unknown) => {
  const response = await authenticatedFetch(path, body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Action impossible.');
  return data;
};
const shortDate = (value: string) => new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const TRANSFER_LABELS = { DONE: 'reversé au propriétaire', WAITING_ACCOUNT: 'versement en attente du compte du propriétaire', FAILED: 'versement échoué', SIMULATED: 'simulation, aucun versement réel' } as const;

/** Finances › Cautions: owners' damage declarations, the tenant's answer, Haven's decision and the charge. */
export function AdminDamageClaims({ name }: { name: (uid: string) => string }) {
  const [claims, setClaims] = useState<DamageClaim[] | null>(null);
  const [error, setError] = useState('');
  const [deciding, setDeciding] = useState<{ claim: DamageClaim; decision: 'APPROVE' | 'REJECT'; amount: string; note: string } | null>(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setClaims((await call('/api/admin/damage-claims')).claims || []); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Cautions indisponibles.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, path: string, body: unknown, success: string) => {
    setBusy(key);
    try {
      const { claim } = await call(path, body);
      if (claim?.status === 'CHARGE_FAILED') toast.error(`Prélèvement refusé : ${claim.charge?.error || 'motif inconnu'}`);
      else toast.success(success);
      setDeciding(null); await load();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Action impossible.'); }
    finally { setBusy(''); }
  };

  if (error) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!claims) return <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Chargement des cautions…</p>;
  const maxCents = deciding ? Math.min(deciding.claim.requestedCents, DAMAGE_DEPOSIT_POLICY.amountCents) : 0;
  const amountCents = deciding ? Math.round(Number(deciding.amount.replace(',', '.')) * 100) : 0;

  return <div className="space-y-4">
    <p className="text-sm text-gray-500">Le propriétaire déclare dans les {DAMAGE_DEPOSIT_POLICY.claimWindowDays} jours suivant le départ ; le locataire est prévenu par e-mail et a 3 jours pour répondre avant tout prélèvement. Comparez avec les états des lieux et lisez la réponse du locataire avant de décider. Rien n’est prélevé sans votre décision ; plafond {formatEuros(DAMAGE_DEPOSIT_POLICY.amountCents / 100)}.</p>
    <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
      {claims.map(claim => <li key={claim.id} className="space-y-3 p-4 text-sm">
        <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between">
          <p className="font-semibold text-haven-navy">{claim.listingTitle} · demandé {formatEuros(claim.requestedCents / 100)}{claim.charge?.isTest ? ' · test' : ''}</p>
          <p className={`text-xs font-semibold ${claim.status === 'CHARGE_FAILED' ? 'text-haven-red' : claim.status === 'SUBMITTED' ? 'text-amber-700' : 'text-gray-500'}`}>{DAMAGE_STATUS_LABELS[claim.status]}</p>
        </div>
        <p className="text-xs text-gray-500">Propriétaire : {name(claim.ownerId)} · Locataire : {name(claim.tenantId)} · départ le {shortDate(claim.stayEndDate)} · déclarée le {shortDate(claim.createdAt)} · {claim.bookingId}</p>
        <p className="whitespace-pre-line rounded-xl bg-gray-50 p-3 text-gray-700">{claim.description}</p>
        <div className="flex flex-wrap gap-2">{claim.photos.map((photo, index) => <a key={index} href={photo} target="_blank" rel="noreferrer"><img src={photo} alt={`Pièce ${index + 1}`} className="h-20 w-20 rounded-xl object-cover" /></a>)}</div>
        <p className="text-gray-700"><span className="font-semibold text-haven-navy">Réponse du locataire : </span>{claim.tenantResponse ? claim.tenantResponse.text : `pas encore de réponse (délai jusqu’au ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(damageResponseDeadline(claim)))}).`}</p>
        {claim.decision && <p className="text-gray-700"><span className="font-semibold text-haven-navy">Décision ({claim.decision.adminName}, {shortDate(claim.decision.at)}) : </span>{claim.status === 'REJECTED' ? 'refusée' : `${formatEuros(claim.decision.amountCents / 100)} retenus`} · {claim.decision.note}</p>}
        {claim.charge?.error && claim.status === 'CHARGE_FAILED' && <p className="text-haven-red">{claim.charge.error} ({claim.charge.attempts} tentative{claim.charge.attempts > 1 ? 's' : ''})</p>}
        {claim.status === 'CHARGED' && claim.transfer && <p className="text-xs text-gray-500">Versement : {TRANSFER_LABELS[claim.transfer.status]}{claim.transfer.error ? ` · ${claim.transfer.error}` : ''}</p>}
        <div className="flex flex-wrap gap-2">
          {claim.status === 'SUBMITTED' && <>
            <button type="button" disabled={!canChargeDamageClaim(claim)} title={canChargeDamageClaim(claim) ? undefined : 'Possible après la réponse du locataire ou la fin de son délai'} onClick={() => setDeciding({ claim, decision: 'APPROVE', amount: String(Math.min(claim.requestedCents, DAMAGE_DEPOSIT_POLICY.amountCents) / 100), note: '' })} className="min-h-11 rounded-xl bg-haven-navy px-3 font-semibold text-white disabled:opacity-40">Retenir et prélever</button>
            <button type="button" onClick={() => setDeciding({ claim, decision: 'REJECT', amount: '', note: '' })} className="min-h-11 rounded-xl border border-gray-200 px-3 font-semibold text-haven-navy">Refuser</button>
          </>}
          {(claim.status === 'CHARGE_FAILED' || (claim.status === 'CHARGED' && (claim.transfer?.status === 'FAILED' || claim.transfer?.status === 'WAITING_ACCOUNT'))) &&
            <button type="button" disabled={busy === claim.id} onClick={() => void act(claim.id, `/api/admin/damage-claims/${claim.bookingId}/retry`, {}, 'Relance effectuée.')} className="min-h-11 rounded-xl border border-gray-200 px-3 font-semibold text-haven-navy">{claim.status === 'CHARGE_FAILED' ? 'Relancer le prélèvement' : 'Relancer le versement'}</button>}
        </div>
      </li>)}
      {!claims.length && <li className="p-8 text-center text-sm text-gray-500">Aucune dégradation déclarée.</li>}
    </ul>

    {deciding && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-haven-navy/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="damage-decision-title" className="haven-dialog-panel w-full max-w-lg space-y-4 rounded-3xl bg-white p-6">
        <h3 id="damage-decision-title" className="text-xl font-bold text-haven-navy">{deciding.decision === 'APPROVE' ? 'Retenir la dégradation' : 'Refuser la déclaration'}</h3>
        <p className="text-sm text-gray-600">{deciding.claim.listingTitle} · locataire {name(deciding.claim.tenantId)}{deciding.claim.tenantResponse ? '' : ' · le locataire n’a pas encore répondu'}</p>
        {deciding.decision === 'APPROVE' && <label className="block text-sm font-semibold text-haven-navy">Montant prélevé (€, au plus {formatEuros(maxCents / 100)})<input inputMode="decimal" value={deciding.amount} onChange={event => setDeciding({ ...deciding, amount: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>}
        <label className="block text-sm font-semibold text-haven-navy">Explication (montrée au propriétaire et au locataire)<textarea value={deciding.note} onChange={event => setDeciding({ ...deciding, note: event.target.value })} rows={3} maxLength={1000} className="mt-1 w-full rounded-xl border border-gray-200 p-3 font-normal" /></label>
        {deciding.decision === 'APPROVE' && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">La carte du locataire est prélevée immédiatement, puis la somme est versée au propriétaire.</p>}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setDeciding(null)} className="min-h-11 rounded-xl px-4 font-semibold text-gray-600 hover:bg-gray-100">Retour</button>
          <button type="button" disabled={deciding.note.trim().length < 3 || (deciding.decision === 'APPROVE' && !(amountCents >= 100 && amountCents <= maxCents)) || busy === 'decision'}
            onClick={() => void act('decision', `/api/admin/damage-claims/${deciding.claim.bookingId}/decision`, { decision: deciding.decision, amountCents, note: deciding.note }, deciding.decision === 'APPROVE' ? 'Montant prélevé.' : 'Déclaration refusée.')}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-bold text-white disabled:opacity-40 ${deciding.decision === 'APPROVE' ? 'bg-haven-red' : 'bg-haven-navy'}`}>{busy === 'decision' && <Loader2 size={16} className="animate-spin" />}{deciding.decision === 'APPROVE' ? `Prélever ${amountCents > 0 ? formatEuros(amountCents / 100) : ''}` : 'Refuser'}</button>
        </div>
      </section>
    </div>}
  </div>;
}
