import { askText } from './HavenDialogs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { Booking, BookingSeries, Listing, OwnerPayout, Payment, User } from '../types';
import { authenticatedFetch } from '../services/serverApi';
import { formatEuros, ownerShare } from '../services/money';
import { settlementLabel } from '../services/stripeConnect';
import { installmentDateLabel, installmentState } from '../services/recurringInstallments';
import { goodwillLimits, havenRefundedCents } from '../services/adminFinances';
import { localDateKey } from '../services/stay';
import { AdminDamageClaims } from './AdminDamageClaims';

type Settlement = { bookingId: string; state: string; amountCents: number; stripeFeeCents?: number | null; havenRefundedCents?: number; adminHold?: boolean; holdReason?: string; error?: string; isTest?: boolean };
type Data = { payments: Payment[]; settlements: Settlement[]; payouts: OwnerPayout[]; series: BookingSeries[] };
type Section = 'MONTH' | 'PAYMENTS' | 'INSTALLMENTS' | 'PAYOUTS' | 'DAMAGES';

const call = async (path: string, body?: unknown) => {
  const response = await authenticatedFetch(path, body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Action impossible.');
  return data;
};
const shortDate = (value?: string) => value ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

/** Money cockpit of the back office: month summary, payments and refunds, installments, payouts. */
export function AdminFinances({ bookings, listings, users }: { bookings: Booking[]; listings: Listing[]; users: User[] }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [section, setSection] = useState<Section>('MONTH');
  const [month, setMonth] = useState(() => localDateKey(new Date()).slice(0, 7));
  const [includeTests, setIncludeTests] = useState(true);
  const [busy, setBusy] = useState('');
  const [refunding, setRefunding] = useState<Booking | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [postponing, setPostponing] = useState<{ booking: Booking; date: string } | null>(null);

  const load = useCallback(async () => {
    setError('');
    try { setData(await call('/api/admin/finances')); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Finances indisponibles.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const name = (id?: string) => { if (!id) return 'Inconnu'; const user = users.find(item => item.id === id); return user ? `${user.firstName} ${user.lastName}` : `Compte ${id.slice(0, 8)}`; };
  const title = (booking: Booking) => booking.listingTitle || listings.find(item => item.id === booking.listingId)?.title || 'Logement';
  const settlementOf = (id: string) => data?.settlements.find(item => item.bookingId === id);
  const isTest = (booking: Booking) => booking.paymentIsTest === true || booking.paymentProvider === 'SIMULATION';

  const paid = useMemo(() => bookings.filter(booking => booking.paymentStatus === 'PAID' && (includeTests || !isTest(booking)))
    .sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || '')), [bookings, includeTests]);
  const inMonth = paid.filter(booking => (booking.paidAt || '').slice(0, 7) === month);
  const refundsInMonth = (data?.payments || []).filter(payment => payment.type === 'REFUND' && payment.createdAt.slice(0, 7) === month && (includeTests || !payment.isTest));
  const totals = {
    count: inMonth.length,
    collected: inMonth.reduce((sum, booking) => sum + booking.totalPrice, 0),
    owners: inMonth.reduce((sum, booking) => sum + (ownerShare(booking) ?? 0), 0),
    commission: inMonth.reduce((sum, booking) => sum + booking.platformFee, 0),
    stripeFees: inMonth.reduce((sum, booking) => sum + (settlementOf(booking.id)?.stripeFeeCents || 0) / 100, 0),
    refunds: refundsInMonth.reduce((sum, payment) => sum + payment.amount, 0),
  };
  const installments = bookings.filter(booking => ['SCHEDULED', 'DUE', 'FAILED'].includes(installmentState(booking)) && (includeTests || !isTest(booking)))
    .sort((a, b) => (a.installmentDueDate || '').localeCompare(b.installmentDueDate || ''));
  const payouts = (data?.payouts || []).filter(payout => includeTests || !payout.isTest).sort((a, b) => (b.paidAt || b.createdAt).localeCompare(a.paidAt || a.createdAt));

  const act = async (key: string, path: string, body: unknown, success: string) => {
    setBusy(key);
    try { await call(path, body); toast.success(success); await load(); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Action impossible.'); }
    finally { setBusy(''); }
  };

  const exportCsv = () => {
    const header = ['Date de paiement', 'Référence', 'Logement', 'Chambre', 'Locataire', 'Propriétaire', 'Arrivée', 'Départ', 'Encaissé', 'Part propriétaire', 'Commission Haven', 'Frais Stripe', 'Remboursé par Haven', 'Versement', 'Test'];
    const rows = inMonth.map(booking => {
      const settlement = settlementOf(booking.id);
      return [shortDate(booking.paidAt), booking.id, title(booking), booking.roomName, name(booking.tenantId), name(booking.ownerId), booking.startDate, booking.endDate,
        booking.totalPrice.toFixed(2), (ownerShare(booking) ?? 0).toFixed(2), booking.platformFee.toFixed(2), ((settlement?.stripeFeeCents || 0) / 100).toFixed(2),
        (havenRefundedCents(booking) / 100).toFixed(2), settlement ? settlementLabel(settlement.state) : booking.paymentProvider === 'SIMULATION' ? 'Simulation' : '—', isTest(booking) ? 'oui' : 'non'];
    });
    const blob = new Blob(['﻿' + [header, ...rows].map(row => row.map(csvCell).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = `haven-finances-${month}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
  };

  if (error) return <div className="space-y-3"><p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p><button type="button" onClick={() => void load()} className="text-sm font-semibold underline">Réessayer</button></div>;
  if (!data) return <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Chargement des finances…</p>;

  const limits = refunding ? goodwillLimits(refunding) : null;
  const amountCents = Math.round(Number(amount.replace(',', '.')) * 100);

  return <section className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-bold text-haven-ink">Finances</h2>
        <p className="mt-1 text-sm text-gray-500">Encaissements, remboursements, échéances des séries et versements aux propriétaires.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={includeTests} onChange={event => setIncludeTests(event.target.checked)} /> Inclure les tests et simulations</label>
        <button type="button" onClick={() => void load()} className="flex min-h-11 items-center gap-1.5 rounded-xl border border-gray-200 px-3 font-semibold text-haven-ink"><RefreshCw size={15} /> Actualiser</button>
      </div>
    </div>

    <nav className="flex flex-wrap gap-2" aria-label="Rubriques financières">
      {([['MONTH', 'Le mois'], ['PAYMENTS', `Paiements (${paid.length})`], ['INSTALLMENTS', `Échéances (${installments.length})`], ['PAYOUTS', `Virements (${payouts.length})`], ['DAMAGES', 'Cautions']] as [Section, string][]).map(([id, label]) => (
        <button key={id} type="button" aria-pressed={section === id} onClick={() => setSection(id)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${section === id ? 'border-haven-navy bg-haven-navy text-white' : 'border-gray-200 text-haven-ink'}`}>{label}</button>
      ))}
    </nav>

    {section === 'MONTH' && <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold text-haven-ink">Mois<input type="month" value={month} onChange={event => setMonth(event.target.value)} className="mt-1 block h-11 rounded-xl border border-gray-200 px-3 font-normal" /></label>
        <button type="button" onClick={exportCsv} disabled={!inMonth.length} className="flex min-h-11 items-center gap-2 rounded-xl bg-haven-navy px-4 text-sm font-bold text-white disabled:opacity-40"><Download size={16} /> Exporter pour la comptabilité (CSV)</button>
      </div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[['Séjours payés', String(totals.count)], ['Encaissé', formatEuros(totals.collected)], ['Part des propriétaires', formatEuros(totals.owners)],
          ['Commission Haven', formatEuros(totals.commission)], ['Frais Stripe', formatEuros(totals.stripeFees)], ['Remboursements', formatEuros(totals.refunds)]].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-gray-200 p-4"><dt className="text-sm text-gray-500">{label}</dt><dd className="mt-1 text-xl font-bold text-haven-ink">{value}</dd></div>
        ))}
      </dl>
      <p className="text-xs text-gray-500">Montants des séjours payés dans le mois. Les frais Stripe n’existent que pour les paiements Stripe ; les simulations n’en ont pas. Résultat Haven du mois : {formatEuros(totals.commission - totals.stripeFees - refundsInMonth.filter(item => !bookings.find(b => b.id === item.bookingId)?.cancellation).reduce((sum, item) => sum + item.amount, 0))} (commission, moins frais Stripe et gestes commerciaux).</p>
    </div>}

    {section === 'PAYMENTS' && <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
      {paid.map(booking => {
        const settlement = settlementOf(booking.id);
        return <li key={booking.id} className="flex flex-col gap-3 p-4 text-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-haven-ink">{title(booking)}{booking.roomName ? ` · ${booking.roomName}` : ''} · {formatEuros(booking.totalPrice)}{isTest(booking) ? ' · test' : ''}</p>
            <p className="text-gray-500">Payé le {shortDate(booking.paidAt)} · séjour du {shortDate(booking.startDate)} au {shortDate(booking.endDate)}{booking.status === 'CANCELLED' ? ' · annulé' : ''}</p>
            <p className="text-xs text-gray-400">Locataire : {name(booking.tenantId)} · Propriétaire : {name(booking.ownerId)} · {booking.id}</p>
            <p className="mt-1 text-xs text-gray-600">Versement : {settlement ? `${settlementLabel(settlement.state)}${settlement.adminHold ? ` · bloqué (${settlement.holdReason})` : ''}${settlement.error ? ` · ${settlement.error}` : ''}` : booking.paymentProvider === 'SIMULATION' ? 'simulation, aucun versement réel' : 'non enregistré'}
              {havenRefundedCents(booking) > 0 && ` · remboursé par Haven : ${formatEuros(havenRefundedCents(booking) / 100)}`}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {booking.status !== 'CANCELLED' && <button type="button" onClick={() => { setRefunding(booking); setAmount(''); setReason(''); }} className="min-h-11 rounded-xl border border-gray-200 px-3 font-semibold text-haven-ink">Rembourser</button>}
            {settlement && !['TRANSFERRED', 'REVERSED', 'PARTIALLY_REVERSED', 'CANCELLED'].includes(settlement.state) && (settlement.adminHold
              ? <button type="button" disabled={busy === `hold-${booking.id}`} onClick={() => void act(`hold-${booking.id}`, `/api/admin/settlements/${booking.id}/hold`, { hold: false }, 'Versement débloqué.')} className="min-h-11 rounded-xl border border-green-200 px-3 font-semibold text-green-700">Débloquer le versement</button>
              : <button type="button" disabled={busy === `hold-${booking.id}`} onClick={async () => { const motive = await askText({ title: 'Bloquer le versement', message: 'Le propriétaire ne sera pas payé tant que le blocage reste en place.', label: 'Motif (litige, suspicion de fraude…)', minLength: 3, multiline: true, confirmLabel: 'Bloquer', danger: true }); if (motive) void act(`hold-${booking.id}`, `/api/admin/settlements/${booking.id}/hold`, { hold: true, reason: motive }, 'Versement bloqué.'); }} className="min-h-11 rounded-xl border border-red-100 px-3 font-semibold text-haven-red">Bloquer le versement</button>)}
            {settlement?.state === 'REVIEW_REQUIRED' && <button type="button" disabled={busy === `retry-${booking.id}`} onClick={() => void act(`retry-${booking.id}`, `/api/admin/settlements/${booking.id}/retry`, {}, 'Transfert relancé.')} className="min-h-11 rounded-xl border border-gray-200 px-3 font-semibold text-haven-ink">Relancer le transfert</button>}
          </div>
        </li>;
      })}
      {!paid.length && <li className="p-8 text-center text-sm text-gray-500">Aucun paiement.</li>}
    </ul>}

    {section === 'INSTALLMENTS' && <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
      {installments.map(booking => {
        const state = installmentState(booking);
        return <li key={booking.id} className="flex flex-col gap-3 p-4 text-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-haven-ink">{title(booking)} · séjour {(booking.seriesIndex ?? 0) + 1} sur {booking.seriesCount} · {formatEuros(booking.totalPrice)}</p>
            <p className="text-gray-500">Arrivée le {shortDate(booking.startDate)} · échéance le {booking.installmentDueDate ? installmentDateLabel(booking.installmentDueDate) : '—'}</p>
            <p className={`text-xs ${state === 'FAILED' ? 'text-haven-red' : 'text-gray-500'}`}>{state === 'FAILED' ? `Échec (${booking.installmentAttempts} tentative${(booking.installmentAttempts || 0) > 1 ? 's' : ''}) : ${booking.installmentLastError || 'motif inconnu'}` : state === 'DUE' ? 'Prélèvement en cours' : 'Prélèvement programmé'} · Locataire : {name(booking.tenantId)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" disabled={busy === `now-${booking.id}`} onClick={() => void act(`now-${booking.id}`, `/api/admin/installments/${booking.id}`, { action: 'RETRY_NOW' }, 'Prélèvement lancé.')} className="min-h-11 rounded-xl border border-gray-200 px-3 font-semibold text-haven-ink">Prélever maintenant</button>
            <button type="button" onClick={() => setPostponing({ booking, date: booking.installmentDueDate || '' })} className="min-h-11 rounded-xl border border-gray-200 px-3 font-semibold text-haven-ink">Changer l’échéance</button>
          </div>
        </li>;
      })}
      {!installments.length && <li className="p-8 text-center text-sm text-gray-500">Aucune échéance en attente.</li>}
    </ul>}

    {section === 'DAMAGES' && <AdminDamageClaims name={name} />}

    {section === 'PAYOUTS' && <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
      {payouts.map(payout => <li key={payout.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
        <span className="font-semibold text-haven-ink">{name(payout.ownerId)} · {formatEuros(payout.amountCents / 100)}{payout.isTest ? ' · test' : ''}</span>
        <span className="text-gray-500">{payout.status === 'PAID' ? `Versé le ${shortDate(payout.paidAt)}` : payout.status === 'FAILED' ? 'Échec du virement' : `En cours, arrivée prévue le ${shortDate(payout.expectedArrivalAt)}`} · {payout.providerPayoutId}</span>
      </li>)}
      {!payouts.length && <li className="p-8 text-center text-sm text-gray-500">Aucun virement Stripe enregistré.</li>}
    </ul>}

    {refunding && limits && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-haven-navy/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="refund-title" className="haven-dialog-panel w-full max-w-lg space-y-4 rounded-3xl bg-white p-6">
        <h3 id="refund-title" className="text-xl font-bold text-haven-ink">Rembourser sans annuler</h3>
        <p className="text-sm text-gray-600">{title(refunding)} · payé {formatEuros(refunding.totalPrice)} · locataire {name(refunding.tenantId)}</p>
        <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">Jusqu’à <strong>{formatEuros(limits.fromCommissionCents / 100)}</strong>, le remboursement est pris sur la commission Haven et la part du propriétaire reste versée. Au-delà (maximum {formatEuros(limits.maxCents / 100)}), le versement au propriétaire passe en vérification.</p>
        <label className="block text-sm font-semibold text-haven-ink">Montant (€)<input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" placeholder="Ex. 20" /></label>
        <label className="block text-sm font-semibold text-haven-ink">Motif (journal d’administration)<textarea value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={300} className="mt-1 w-full rounded-xl border border-gray-200 p-3 font-normal" placeholder="Ex. : geste commercial suite à une panne de chauffage" /></label>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setRefunding(null)} className="min-h-11 rounded-xl px-4 font-semibold text-gray-600 hover:bg-gray-100">Retour</button>
          <button type="button" disabled={!(amountCents > 0 && amountCents <= limits.maxCents) || reason.trim().length < 3 || busy === 'refund'}
            onClick={() => void act('refund', `/api/admin/bookings/${refunding.id}/refund`, { amountCents, reason }, 'Remboursement enregistré.').then(() => setRefunding(null))}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-haven-red px-4 font-bold text-white disabled:opacity-40">{busy === 'refund' && <Loader2 size={16} className="animate-spin" />}Rembourser {amountCents > 0 ? formatEuros(amountCents / 100) : ''}</button>
        </div>
      </section>
    </div>}

    {postponing && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-haven-navy/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="postpone-title" className="haven-dialog-panel w-full max-w-md space-y-4 rounded-3xl bg-white p-6">
        <h3 id="postpone-title" className="text-xl font-bold text-haven-ink">Changer la date de prélèvement</h3>
        <p className="text-sm text-gray-600">{title(postponing.booking)} · arrivée le {shortDate(postponing.booking.startDate)}. Le délai de 5 jours en cas d’échec repart de la nouvelle date.</p>
        <input type="date" min={localDateKey(new Date())} max={postponing.booking.startDate} value={postponing.date} onChange={event => setPostponing({ ...postponing, date: event.target.value })} className="h-11 w-full rounded-xl border border-gray-200 px-3" />
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setPostponing(null)} className="min-h-11 rounded-xl px-4 font-semibold text-gray-600 hover:bg-gray-100">Retour</button>
          <button type="button" disabled={!postponing.date || busy === 'postpone'} onClick={() => void act('postpone', `/api/admin/installments/${postponing.booking.id}`, { action: 'POSTPONE', dueDate: postponing.date }, 'Échéance modifiée.').then(() => setPostponing(null))} className="min-h-11 rounded-xl bg-haven-navy px-4 font-bold text-white disabled:opacity-40">Enregistrer</button>
        </div>
      </section>
    </div>}
  </section>;
}
