import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ClipboardCheck, Home, Info, Loader2, Mail, Phone, UserRound, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import type { InventoryReport, ReportStatus } from '../types';
import type { CaseMember, CaseStay, ReportCase } from '../services/reportCase';
import { authenticatedFetch } from '../services/serverApi';
import { formatEuros } from '../services/money';
import { inventoryDocumentHtml } from '../services/inventoryDocument';
import { settlementLabel } from '../services/stripeConnect';
import { prepareImageForStorage } from '../services/images';
import { DAMAGE_DEPOSIT_POLICY, DAMAGE_STATUS_LABELS } from '../services/damageDeposit';

const call = async (path: string, body?: unknown) => {
  const response = await authenticatedFetch(path, body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Action impossible.');
  return data;
};
const day = (value?: string) => value ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const STATUS: Record<string, string> = { NEW: 'Nouveau', INVESTIGATING: 'En cours', WAITING_OWNER: 'En attente du propriétaire', RESOLVED: 'Résolu', DISMISSED: 'Classé', CONFIRMED: 'Confirmé', COMPLETED: 'Terminé', CANCELLED: 'Annulé', PENDING: 'En attente', RESOLVED_INCIDENT: 'Résolu' };

/** Shrinks a report photo to the size accepted for a deposit claim. */
async function claimPhoto(dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob();
  return prepareImageForStorage(new File([blob], 'photo', { type: blob.type || 'image/jpeg' }), 20 * 1024 * 1024);
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-gray-200 p-4 sm:p-5">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-haven-navy">{icon}{title}</h3>
    {children}
  </section>;
}

function Person({ label, member, onOpen }: { label: string; member: CaseMember | null; onOpen: (id: string) => void }) {
  if (!member) return <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">{label} : inconnu</div>;
  return <div className="rounded-xl bg-gray-50 p-3 text-sm">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="mt-0.5 font-bold text-haven-navy">{member.firstName} {member.lastName}</p>
    <div className="mt-2 flex flex-wrap gap-2">
      {member.email && <a href={`mailto:${member.email}`} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-haven-navy"><Mail size={12} />{member.email}</a>}
      {member.phone && <a href={`tel:${member.phone}`} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-haven-navy"><Phone size={12} />{member.phone}</a>}
      <button type="button" onClick={() => onOpen(member.id)} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-haven-navy">Fiche 360°</button>
    </div>
  </div>;
}

function openInventory(report: InventoryReport, stay: CaseStay, title: string) {
  const html = inventoryDocumentHtml(report, title, { booking: stay.booking, tenant: stay.tenant ? { id: stay.tenant.id, firstName: stay.tenant.firstName, lastName: stay.tenant.lastName, email: stay.tenant.email, phone: stay.tenant.phone } : undefined });
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function StayBlock({ stay, label }: { stay: CaseStay; label: string }) {
  const { booking } = stay;
  return <div className="space-y-2 text-sm">
    <p className="font-semibold text-haven-navy">{label} · {day(booking.startDate)} → {day(booking.endDate)} · {booking.roomName || 'Chambre'}</p>
    <p className="text-xs text-gray-500">{STATUS[booking.status] || booking.status} · {formatEuros(booking.totalPrice)}{booking.paymentIsTest ? ' · test' : ''} · {booking.id}</p>
    <div className="flex flex-wrap gap-2">
      {(['checkIn', 'checkOut'] as const).map(key => {
        const report = stay[key];
        const text = key === 'checkIn' ? 'État des lieux d’entrée' : 'État des lieux de sortie';
        return report
          ? <button key={key} type="button" onClick={() => openInventory(report, stay, `${text} – ${booking.listingTitle || ''}`)} className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-haven-navy hover:bg-gray-50"><ClipboardCheck size={14} />{text} ({day(report.date)})</button>
          : <span key={key} className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">{text} : non fait</span>;
      })}
    </div>
  </div>;
}

/** Report file: everything needed to settle it, the reading of the situation and the tools to act. */
export function AdminReportCase({ reportId, bookingId, onClose, onOpenMember, onStatus, onOpenFinances }: {
  /** Opened from a report, or from a booking (then without the report part). */
  reportId?: string; bookingId?: string; onClose: () => void; onOpenMember: (userId: string) => void; onStatus?: (status: ReportStatus, note: string) => Promise<void>; onOpenFinances: () => void;
}) {
  const [file, setFile] = useState<ReportCase | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimOpen, setClaimOpen] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const path = reportId ? `/api/admin/reports/${encodeURIComponent(reportId)}/case` : `/api/admin/bookings/${encodeURIComponent(bookingId || '')}/case`;
    try { setFile(await call(path)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Dossier indisponible.'); }
  }, [reportId, bookingId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', keydown);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = overflow; };
  }, [onClose]);

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try { await action(); toast.success(success); await load(); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Action impossible.'); }
    finally { setBusy(''); }
  };
  const close = (status: ReportStatus) => run(status, async () => onStatus?.(status, conclusion.trim()), status === 'RESOLVED' ? 'Signalement résolu.' : status === 'DISMISSED' ? 'Signalement classé.' : 'Examen en cours.');
  const hold = () => {
    const reason = window.prompt('Motif du blocage du versement', `Signalement à l’arrivée : ${file?.report.supportCategory || 'examen en cours'}`);
    if (reason && file?.stay) void run('hold', () => call(`/api/admin/settlements/${file.stay!.booking.id}/hold`, { hold: true, reason }), 'Versement bloqué.');
  };
  const openClaim = () => {
    if (!file?.previousStay) return;
    const amountCents = Math.round(Number(claimAmount.replace(',', '.')) * 100);
    void run('claim', async () => {
      const photos = await Promise.all((file.report?.photos || []).slice(0, 6).map(claimPhoto));
      const description = `Constaté à l’arrivée du locataire suivant le ${day(file.stay?.booking.startDate)} : ${file.report?.supportCategory || ''} — ${file.report?.description || ''}`.slice(0, 2000);
      await call(`/api/admin/bookings/${file.previousStay!.booking.id}/damage-claim`, { amountCents, description, photos, reportId: file.report?.id });
      setClaimOpen(false);
    }, 'Demande ouverte : à décider dans Finances › Cautions, après la réponse du locataire.');
  };

  const report = file?.report;
  const closed = report && ['RESOLVED', 'DISMISSED'].includes(report.status);
  const claimCents = Math.round(Number(claimAmount.replace(',', '.')) * 100);
  return <div className="fixed inset-0 z-[90] flex items-stretch justify-end bg-haven-navy/50 backdrop-blur-sm" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <aside role="dialog" aria-modal="true" aria-label="Dossier du signalement" className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
      <header className="flex items-center justify-between gap-4 border-b border-gray-100 p-5">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-haven-red">{reportId ? 'Dossier du signalement' : 'Dossier du séjour'}</p>
          <h2 className="truncate text-xl font-bold text-haven-navy">{report ? `${report.supportCategory || report.reason}` : file?.stay ? `${file.stay.booking.listingTitle || file.listing?.title || 'Séjour'}${file.stay.booking.roomName ? ` · ${file.stay.booking.roomName}` : ''}` : 'Chargement…'}</h2>
        </div>
        <button type="button" aria-label="Fermer le dossier" onClick={onClose} className="rounded-full bg-gray-100 p-3"><X size={20} /></button>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {!file && !error && <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" />Rassemblement du dossier…</p>}
        {file && <>
          {report && <Section icon={<AlertTriangle size={16} />} title={`Signalement · ${STATUS[report.status] || report.status}`}>
            <p className="text-xs text-gray-500">Le {new Date(report.timestamp).toLocaleString('fr-FR')}</p>
            <p className="mt-2 whitespace-pre-line rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{report.description}</p>
            {!!report.photos?.length && <div className="mt-3 flex flex-wrap gap-2">{report.photos.map((photo, index) => <a key={index} href={photo} target="_blank" rel="noreferrer"><img src={photo} alt={`Photo ${index + 1} du signalement`} className="h-28 w-28 rounded-xl object-cover" /></a>)}</div>}
            {report.adminNotes && <p className="mt-3 text-sm text-gray-600"><span className="font-semibold text-haven-navy">Note Haven : </span>{report.adminNotes}</p>}
          </Section>}
          {!!file.related.length && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{report ? 'Aussi sur ce séjour' : 'Sur ce séjour'} : {file.related.map(item => `${item.kind === 'INCIDENT' ? 'incident' : 'signalement'} « ${item.title} » (${STATUS[item.status] || item.status})`).join(' · ')}</p>}

          {!!file.guidance.length && <Section icon={<Zap size={16} />} title="Lecture du dossier">
            <ul className="space-y-2 text-sm">{file.guidance.map((item, index) => <li key={index} className={`flex gap-2 rounded-xl p-3 ${item.tone === 'ACTION' ? 'bg-blue-50 text-blue-900' : item.tone === 'WARNING' ? 'bg-amber-50 text-amber-900' : 'bg-gray-50 text-gray-700'}`}><Info size={16} className="mt-0.5 shrink-0" />{item.text}</li>)}</ul>
          </Section>}

          <Section icon={<UserRound size={16} />} title="Personnes">
            <div className="grid gap-3 sm:grid-cols-2">
              {report ? <Person label="Locataire qui signale" member={file.reporter} onOpen={onOpenMember} /> : <Person label="Locataire" member={file.stay?.tenant || null} onOpen={onOpenMember} />}
              <Person label="Propriétaire" member={file.owner} onOpen={onOpenMember} />
              {file.previousStay && <Person label={`Locataire précédent (parti le ${day(file.previousStay.booking.endDate)})`} member={file.previousStay.tenant} onOpen={onOpenMember} />}
            </div>
          </Section>

          {file.listing && <Section icon={<Home size={16} />} title="Logement">
            <p className="text-sm font-semibold text-haven-navy">{file.listing.title}{file.listing.roomName ? ` · ${file.listing.roomName}` : ''}</p>
            <p className="text-xs text-gray-500">{file.listing.address || file.listing.city}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link to={`/listing/${file.listing.id}`} target="_blank" className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-haven-navy">Voir l’annonce</Link>
              <Link to={`/owner/edit/${file.listing.id}`} target="_blank" className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-haven-navy">Corriger l’annonce</Link>
            </div>
          </Section>}

          <Section icon={<ClipboardCheck size={16} />} title="Séjours et états des lieux">
            <div className="space-y-4">
              {file.previousStay ? <StayBlock stay={file.previousStay} label="Séjour précédent" /> : <p className="text-sm text-gray-500">Aucun séjour Haven avant celui-ci dans cette chambre.</p>}
              {file.previousStay?.damageClaim && <p className="text-xs text-gray-600">Caution du locataire précédent : {DAMAGE_STATUS_LABELS[file.previousStay.damageClaim.status]} ({formatEuros(file.previousStay.damageClaim.requestedCents / 100)} demandés).</p>}
              {file.stay && <StayBlock stay={file.stay} label={report ? 'Séjour signalé' : 'Ce séjour'} />}
              {file.settlement && <p className="text-xs text-gray-600">Versement au propriétaire : {settlementLabel(file.settlement.state)} · {formatEuros(file.settlement.amountCents / 100)}{file.settlement.adminHold ? ` · bloqué (${file.settlement.holdReason || 'sans motif'})` : ''}</p>}
            </div>
          </Section>

          <Section icon={<Zap size={16} />} title="Agir">
            <div className="flex flex-wrap gap-2">
              {file.settlement && !file.settlement.adminHold && !['TRANSFERRED', 'REVERSED', 'PARTIALLY_REVERSED', 'CANCELLED'].includes(file.settlement.state) &&
                <button type="button" disabled={busy === 'hold'} onClick={hold} className="min-h-11 rounded-xl border border-red-100 px-3 text-sm font-semibold text-haven-red">Bloquer le versement au propriétaire</button>}
              {report && file.previousStay && !file.previousStay.damageClaim && file.previousStay.booking.depositConsent &&
                <button type="button" onClick={() => setClaimOpen(value => !value)} className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-haven-navy">Demande sur la caution du locataire précédent</button>}
              <button type="button" onClick={onOpenFinances} className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-haven-navy">Rembourser le locataire (Finances › Paiements)</button>
            </div>
            {claimOpen && <div className="mt-3 space-y-2 rounded-xl bg-gray-50 p-3 text-sm">
              <p className="text-gray-600">La demande reprend la description et les photos du signalement. Le locataire précédent pourra y répondre ; vous déciderez ensuite dans Finances › Cautions.</p>
              <label className="block font-semibold text-haven-navy">Montant demandé (€, au plus {DAMAGE_DEPOSIT_POLICY.amountCents / 100})<input inputMode="decimal" value={claimAmount} onChange={event => setClaimAmount(event.target.value)} placeholder="Ex. 40 (une heure de ménage)" className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal" /></label>
              <button type="button" disabled={!(claimCents >= 100 && claimCents <= DAMAGE_DEPOSIT_POLICY.amountCents) || !report?.photos?.length || busy === 'claim'} onClick={openClaim} className="flex min-h-11 items-center gap-2 rounded-xl bg-haven-navy px-4 font-bold text-white disabled:opacity-40">{busy === 'claim' && <Loader2 size={16} className="animate-spin" />}Ouvrir la demande</button>
              {!report?.photos?.length && <p className="text-xs text-haven-red">Le signalement n’a pas de photo : demandez-en une au locataire ou au propriétaire.</p>}
            </div>}
            {report && onStatus && !closed && <div className="mt-4 space-y-2">
              <label className="block text-sm font-semibold text-haven-navy">Conclusion (enregistrée au journal)<textarea value={conclusion} onChange={event => setConclusion(event.target.value)} rows={3} maxLength={2000} placeholder="Ex. : ménage refait par le propriétaire le jour même, demande ouverte sur la caution du locataire précédent." className="mt-1 w-full rounded-xl border border-gray-200 p-3 font-normal" /></label>
              <div className="flex flex-wrap gap-2">
                {report.status === 'NEW' && <button type="button" disabled={!!busy} onClick={() => void close('INVESTIGATING')} className="min-h-11 rounded-xl bg-amber-600 px-4 text-sm font-bold text-white">Prendre en charge</button>}
                <button type="button" disabled={!!busy || conclusion.trim().length < 3} onClick={() => void close('RESOLVED')} className="min-h-11 rounded-xl bg-green-600 px-4 text-sm font-bold text-white disabled:opacity-40">Marquer résolu</button>
                <button type="button" disabled={!!busy || conclusion.trim().length < 3} onClick={() => void close('DISMISSED')} className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-600 disabled:opacity-40">Classer sans suite</button>
              </div>
            </div>}
          </Section>
        </>}
      </div>
    </aside>
  </div>;
}
