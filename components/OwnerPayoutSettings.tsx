import { useEffect, useState } from 'react';
import { Wallet, ExternalLink, RefreshCw } from 'lucide-react';
import type { OwnerPayout } from '../types';
import { ownerPayoutStatusLabel } from '../services/ownerFinances';
import { apiService } from '../services/api';
import { settlementLabel, type OwnerConnectView, type OwnerSettlementView } from '../services/stripeConnect';

const labels: Record<OwnerConnectView['status'], string> = {
  NOT_STARTED: 'Versements à configurer', INCOMPLETE: 'Informations à compléter',
  PENDING: 'Vérification Stripe en cours', READY: 'Versements activés', RESTRICTED: 'Action requise chez Stripe'
};
export function OwnerPayoutSettings({ payouts = [] }: { payouts?: OwnerPayout[] }) {
  const [account, setAccount] = useState<OwnerConnectView | null>(null);
  const [settlements, setSettlements] = useState<OwnerSettlementView[]>([]);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true, busy = false;
    const refresh = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const result = await apiService.ownerConnect.getMine();
        if (active) { setAccount(result.account); setSettlements(result.settlements); setError(''); }
      } catch (failure) { if (active) setError((failure as Error).message); }
      finally { busy = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [revision]);
  const open = async (action: 'onboarding' | 'dashboard') => {
    setOpening(true); setError('');
    try { window.location.assign(await apiService.ownerConnect.open(action)); }
    catch (failure) { setError((failure as Error).message); setOpening(false); }
  };
  return <section className="rounded-3xl border border-gray-100 p-5 sm:p-8 space-y-5" aria-labelledby="payout-settings-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 id="payout-settings-title" className="text-xl font-bold text-haven-navy flex items-center gap-2"><Wallet size={22} /> Mes versements</h3>
      <button type="button" onClick={() => setRevision(value => value + 1)} className="min-h-11 flex items-center gap-2 text-sm text-haven-navy"><RefreshCw size={16} /> Actualiser</button>
    </div>
    <p className="text-sm text-gray-600 leading-relaxed">Renseignez votre identité et votre compte bancaire directement chez Stripe. Votre part comprend le prix du séjour et le forfait ménage. Haven prend en charge les frais Stripe sur ses propres frais de service.</p>
    <p className="text-sm text-gray-600 leading-relaxed">Le transfert vers votre solde Stripe est déclenché après la validation de l’état des lieux d’entrée par le locataire. Stripe effectue ensuite le virement vers votre banque selon son calendrier et la disponibilité des fonds. Seuls les virements confirmés comme versés sont inclus dans vos revenus versés.</p>
    {error && <p role="alert" className="text-sm text-haven-red">{error} Les informations affichées peuvent ne plus être à jour.</p>}
    {!account && !error && <p role="status" className="text-sm text-gray-500">Vérification de votre compte…</p>}
    {account && !account.available ? <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">La configuration des versements sera disponible dès l’activation de Stripe Connect par Haven. Aucun virement réel n’est simulé.</p> : account && <div className="rounded-2xl bg-gray-50 p-4 sm:p-5 space-y-3">
      <p className="font-bold text-haven-navy" role="status">{labels[account.status]}{account.isTest ? ' · Mode test' : ''}</p>
      {account.bank && <p className="text-sm text-gray-600">{account.bank.name || 'Compte bancaire'} · se terminant par {account.bank.last4}</p>}
      {account.checkedAt && <p className="text-xs text-gray-500">Vérifié le {new Date(account.checkedAt).toLocaleString('fr-FR')}</p>}
      <div className="flex flex-col sm:flex-row gap-3">
        {account.status !== 'READY' && <button type="button" disabled={opening} onClick={() => void open('onboarding')} className="min-h-12 rounded-xl bg-haven-navy px-5 py-3 text-white font-bold disabled:opacity-50">{opening ? 'Ouverture de Stripe…' : account.status === 'NOT_STARTED' ? 'Configurer mes versements' : 'Compléter mes informations'}</button>}
        {account.status !== 'NOT_STARTED' && <button type="button" disabled={opening} onClick={() => void open('dashboard')} className="min-h-12 rounded-xl border border-gray-200 px-5 py-3 text-haven-navy font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">Gérer chez Stripe <ExternalLink size={16} /></button>}
      </div>
    </div>}
    {account?.available && account.isTest && payouts.some(item => item.provider === 'STRIPE' && item.isTest) && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <h4 className="font-bold text-haven-navy">Virements Stripe de test</h4>
      <p className="text-xs text-gray-600">Ces montants sont fictifs et restent exclus de vos revenus réels. Les statuts proviennent de la Sandbox Stripe.</p>
      {payouts.filter(item => item.provider === 'STRIPE' && item.isTest).map(item => <div key={item.id} className="flex flex-wrap justify-between gap-2 border-t border-amber-200 pt-3 text-sm"><span>{ownerPayoutStatusLabel(item.status)}</span><span className="font-bold">{new Intl.NumberFormat('fr-FR', {style:'currency',currency:'EUR'}).format(item.amountCents / 100)}</span></div>)}
    </div>}
    {settlements.length > 0 && <div className="space-y-3">
      <h4 className="font-bold text-haven-navy">Suivi des transferts par réservation</h4>
      <p className="text-xs text-gray-500">Ces transferts vers Stripe sont distincts des virements vers votre banque.</p>
      {settlements.map(item => <div key={item.bookingId} className="flex flex-wrap gap-2 justify-between border-t border-gray-100 pt-3 text-sm">
        <div className="min-w-0"><p className="break-all text-xs text-gray-500">Réservation {item.bookingId}{item.isTest ? ' · Test' : ''}</p><p className="text-haven-navy mt-1">{settlementLabel(item.state)}</p>{item.error && <p className="text-xs text-haven-red mt-1">{item.error}</p>}</div>
        <p className="font-bold text-haven-navy">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(item.amountCents / 100)}</p>
      </div>)}
    </div>}
  </section>;
}
