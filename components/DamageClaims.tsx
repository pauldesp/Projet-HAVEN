import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Booking, DamageClaim } from '../types';
import { authenticatedFetch } from '../services/serverApi';
import { formatEuros } from '../services/money';
import { prepareImageForStorage } from '../services/images';
import { damageResponseDeadline, DAMAGE_DEPOSIT_POLICY, DAMAGE_DESCRIPTION_MIN, DAMAGE_MAX_PHOTOS, DAMAGE_STATUS_LABELS, canDeclareDamage, damageClaimDeadline } from '../services/damageDeposit';

const call = async (path: string, body?: unknown) => {
  const response = await authenticatedFetch(path, body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Action impossible.');
  return data;
};
const day = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Damage claims where the signed-in member is the owner or the tenant. */
export function useDamageClaims(enabled = true) {
  const [claims, setClaims] = useState<DamageClaim[]>([]);
  const reload = useCallback(async () => {
    if (!enabled) return;
    try { setClaims((await call('/api/me/damage-claims')).claims || []); } catch { /* Shown again on the next load. */ }
  }, [enabled]);
  useEffect(() => { void reload(); }, [reload]);
  return { claims, reload };
}

function ClaimSummary({ claim, viewer }: { claim: DamageClaim; viewer: 'OWNER' | 'TENANT' }) {
  return <div className="space-y-3 text-sm text-gray-700">
    <p><span className="font-bold text-haven-navy">{DAMAGE_STATUS_LABELS[claim.status]}</span> · demandé : {formatEuros(claim.requestedCents / 100)}{claim.decision && claim.status !== 'REJECTED' ? ` · retenu : ${formatEuros(claim.decision.amountCents / 100)}` : ''}</p>
    <p className="whitespace-pre-line rounded-xl bg-gray-50 p-3">{claim.description}</p>
    <div className="flex flex-wrap gap-2">{claim.photos.map((photo, index) => <a key={index} href={photo} target="_blank" rel="noreferrer"><img src={photo} alt={`Pièce jointe ${index + 1}`} className="h-20 w-20 rounded-xl object-cover" /></a>)}</div>
    {claim.tenantResponse && <div><p className="font-bold text-haven-navy">{viewer === 'TENANT' ? 'Votre réponse' : 'Réponse du locataire'}</p><p className="mt-1 whitespace-pre-line">{claim.tenantResponse.text}</p></div>}
    {claim.decision && <div><p className="font-bold text-haven-navy">Décision de Haven</p><p className="mt-1 whitespace-pre-line">{claim.decision.note}</p></div>}
  </div>;
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [onClose]);
  return createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center bg-haven-navy/50 p-3 backdrop-blur-sm sm:p-6" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="haven-dialog-panel flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white text-left shadow-2xl">
      <header className="flex items-center justify-between gap-4 border-b border-gray-100 p-5"><h2 id={titleId} className="text-xl font-bold text-haven-navy">{title}</h2><button type="button" aria-label="Fermer" onClick={onClose} className="rounded-full bg-gray-100 p-3"><X size={20} /></button></header>
      <div className="haven-dialog-scroll space-y-4 overflow-y-auto p-5 sm:p-7">{children}</div>
    </div>
  </div>, document.body);
}

/** Owner: declare damage within 7 days after departure, then follow the decision. */
export function OwnerDamageClaimButton({ booking, claim, onChanged }: { booking: Booking; claim?: DamageClaim; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!claim && !canDeclareDamage(booking)) return null;
  const amountCents = Math.round(Number(amount.replace(',', '.')) * 100);
  const valid = amountCents >= 100 && amountCents <= DAMAGE_DEPOSIT_POLICY.amountCents && description.trim().length >= DAMAGE_DESCRIPTION_MIN && photos.length >= 1;
  const addPhotos = async (files: FileList | null) => {
    setError('');
    try {
      const prepared = await Promise.all(Array.from(files || []).slice(0, DAMAGE_MAX_PHOTOS - photos.length).map(file => prepareImageForStorage(file)));
      setPhotos(current => [...current, ...prepared].slice(0, DAMAGE_MAX_PHOTOS));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Photo illisible.'); }
  };
  const submit = async () => {
    setBusy(true); setError('');
    try {
      await call(`/api/bookings/${encodeURIComponent(booking.id)}/damage-claim`, { amountCents, description, photos });
      toast.success('Déclaration envoyée à Haven.');
      setOpen(false); onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Envoi impossible.'); }
    finally { setBusy(false); }
  };
  return <>
    {claim
      ? <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Dégradation : {DAMAGE_STATUS_LABELS[claim.status].toLowerCase()}</button>
      : <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-haven-navy hover:bg-gray-50"><AlertTriangle size={14} />Déclarer une dégradation</button>}
    {open && <Dialog title={claim ? 'Dégradation déclarée' : 'Déclarer une dégradation'} onClose={() => setOpen(false)}>
      {claim ? <ClaimSummary claim={claim} viewer="OWNER" /> : <>
        <p className="text-sm text-gray-600">Possible jusqu’au {day(damageClaimDeadline(booking))} inclus. Haven compare avec les états des lieux, recueille la réponse du locataire puis décide. Si la dégradation est retenue, la carte du locataire est prélevée (au plus {formatEuros(DAMAGE_DEPOSIT_POLICY.amountCents / 100)}) et la somme vous est reversée.</p>
        <label className="block text-sm font-semibold text-haven-navy">Montant demandé (€)<input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder={`Au plus ${DAMAGE_DEPOSIT_POLICY.amountCents / 100}`} className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
        <label className="block text-sm font-semibold text-haven-navy">Description de la dégradation et du coût<textarea value={description} onChange={event => setDescription(event.target.value)} rows={5} maxLength={2000} placeholder="Ex. : porte de placard de la chambre arrachée, absente de l’état des lieux d’entrée. Remplacement : 85 € (devis joint)." className="mt-1 w-full rounded-xl border border-gray-200 p-3 font-normal" /></label>
        <div>
          <p className="text-sm font-semibold text-haven-navy">Photos, devis ou facture ({photos.length}/{DAMAGE_MAX_PHOTOS})</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((photo, index) => <div key={index} className="relative"><img src={photo} alt={`Pièce ${index + 1}`} className="h-20 w-20 rounded-xl object-cover" /><button type="button" aria-label={`Retirer la pièce ${index + 1}`} onClick={() => setPhotos(current => current.filter((_, i) => i !== index))} className="absolute -right-2 -top-2 rounded-full bg-white p-1 shadow"><X size={14} /></button></div>)}
            {photos.length < DAMAGE_MAX_PHOTOS && <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border border-dashed border-gray-300 text-gray-500"><ImagePlus size={20} /><span className="sr-only">Ajouter des photos</span><input type="file" accept="image/*" multiple className="sr-only" onChange={event => { void addPhotos(event.target.files); event.target.value = ''; }} /></label>}
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-haven-red">{error}</p>}
        <button type="button" disabled={!valid || busy} onClick={() => void submit()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-haven-navy px-4 font-bold text-white disabled:opacity-40">{busy && <Loader2 size={16} className="animate-spin" />}Envoyer à Haven</button>
      </>}
    </Dialog>}
  </>;
}

/** Tenant: claims about their stays, with one answer before Haven decides. */
export function TenantDamageClaims({ claims, tenantId, onChanged }: { claims: DamageClaim[]; tenantId: string; onChanged: () => void }) {
  const mine = claims.filter(claim => claim.tenantId === tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  if (!mine.length) return null;
  const respond = async (claim: DamageClaim) => {
    setBusy(claim.id);
    try { await call(`/api/bookings/${encodeURIComponent(claim.bookingId)}/damage-claim/response`, { text: texts[claim.id] || '' }); toast.success('Réponse envoyée à Haven.'); onChanged(); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Envoi impossible.'); }
    finally { setBusy(''); }
  };
  return <section aria-label="Dégradations déclarées" className="mt-6 space-y-4">
    {mine.map(claim => <article key={claim.id} className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-bold text-haven-navy"><AlertTriangle size={18} className="text-amber-600" />Dégradation déclarée · {claim.listingTitle}</h2>
      <p className="mb-3 mt-1 text-xs text-gray-500">Séjour terminé le {day(claim.stayEndDate)} · déclarée le {day(claim.createdAt)}</p>
      <ClaimSummary claim={claim} viewer="TENANT" />
      {claim.status === 'SUBMITTED' && !claim.tenantResponse && <div className="mt-4 space-y-2">
        <p className="text-sm text-amber-900">Répondez avant le <strong>{new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(damageResponseDeadline(claim)))}</strong> : passé ce délai, Haven décide avec les éléments dont il dispose.</p>
        <label className="block text-sm font-semibold text-haven-navy">Votre réponse, lue par Haven avant toute décision<textarea value={texts[claim.id] || ''} onChange={event => setTexts(current => ({ ...current, [claim.id]: event.target.value }))} rows={4} maxLength={2000} placeholder="Votre version des faits, et ce qui figurait déjà à l’état des lieux d’entrée." className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 font-normal" /></label>
        <button type="button" disabled={(texts[claim.id] || '').trim().length < 5 || busy === claim.id} onClick={() => void respond(claim)} className="flex min-h-11 items-center gap-2 rounded-xl bg-haven-navy px-4 text-sm font-bold text-white disabled:opacity-40">{busy === claim.id && <Loader2 size={16} className="animate-spin" />}Envoyer ma réponse</button>
      </div>}
    </article>)}
  </section>;
}
