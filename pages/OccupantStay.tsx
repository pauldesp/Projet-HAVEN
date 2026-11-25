import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, CalendarDays, ClipboardCheck, KeyRound, LogOut, MapPin, MessageSquare, Send } from 'lucide-react';
import { InventoryModal } from '../components/InventoryModal';
import { ReportModal } from '../components/ReportModal';
import { PageSkeleton } from '../components/PageSkeleton';
import { getInventoryTiming, formatScheduledMoment } from '../services/inventoryTiming';
import { compactCheckinComments } from '../services/inventoryPayload';
import { submitInventoryReport } from '../services/inventorySubmission';
import { pollWhileVisible } from '../services/visiblePolling';
import { PRACTICAL_INFO_FIELDS } from '../services/stayGuide';
import type { Booking, Listing, Room } from '../types';

/**
 * Stay space of an occupant booked by someone else (no Haven account). The personal link in the URL opens one
 * stay: its information, the access instructions once released, both inventories, issue reporting and the
 * conversation with the owner. Payment, cancellation, deposit and review stay with the account that booked.
 */
type StaySpace = {
  stay: Booking & { listingTitle: string; roomName: string; checkInTime: string; checkOutTime: string; timeZone: string };
  occupant: { firstName: string; lastName: string };
  bookerName: string; bookerFirstName: string; ownerFirstName: string;
  address: string; rules: string[]; room: { id: string; name: string } | null;
  instructionsDueAt: string; arrivalInformationAvailable: boolean; instructions: string;
  practicalInfo?: Record<string, string>; roomGuide?: { location?: string; keyLabel?: string; doorPhoto?: string; interiorPhoto?: string };
};
type StayMessage = { id: string; content: string; timestamp: string; from: 'OWNER' | 'BOOKER' | 'OCCUPANT' };

const stayFetch = async (token: string, path = '', init: RequestInit = {}) => {
  const response = await fetch(`/api/stay/${encodeURIComponent(token)}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Votre espace séjour est momentanément indisponible.');
  return payload;
};
const longDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const createId = () => `occ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function Section({ icon: Icon, title, children }: { icon: typeof MapPin; title: string; children: React.ReactNode }) {
  return <section className="rounded-[1.75rem] border border-haven-gray bg-white p-5 sm:p-7">
    <h2 className="flex items-center gap-3 font-heading text-2xl font-normal text-haven-ink"><Icon size={22} strokeWidth={1.6} className="text-haven-navy" aria-hidden="true" />{title}</h2>
    <div className="mt-4 text-[15px] leading-relaxed text-gray-700">{children}</div>
  </section>;
}

export default function OccupantStay() {
  const { token = '' } = useParams();
  const [space, setSpace] = useState<StaySpace | null>(null);
  const [error, setError] = useState('');
  const [inventory, setInventory] = useState<'IN' | 'OUT' | null>(null);
  const [reporting, setReporting] = useState(false);
  const [messages, setMessages] = useState<StayMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try { setSpace(await stayFetch(token)); setError(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Lien invalide.'); }
  }, [token]);
  const loadMessages = useCallback(async () => {
    try { setMessages((await stayFetch(token, '/messages')).messages || []); } catch { /* shown on the next attempt */ }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (space) return pollWhileVisible(loadMessages, 20_000); }, [space, loadMessages]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);

  if (error) return <div className="mx-auto max-w-xl px-5 py-20 text-center">
    <h1 className="font-heading text-3xl font-normal text-haven-ink">Espace séjour</h1>
    <p role="alert" className="mt-4 text-gray-600">{error}</p>
  </div>;
  if (!space) return <PageSkeleton variant="list" label="Chargement de votre séjour…" />;

  const { stay } = space;
  const listing = { id: stay.listingId, title: stay.listingTitle, checkInTime: stay.checkInTime, checkOutTime: stay.checkOutTime, rooms: space.room ? [space.room as Room] : [] } as unknown as Listing;
  const inTiming = getInventoryTiming(stay, listing, 'IN');
  const outTiming = getInventoryTiming(stay, listing, 'OUT');
  const canCheckIn = stay.status === 'CONFIRMED' && !stay.checkInReportId && inTiming.isAvailable;
  const canCheckOut = stay.status === 'CONFIRMED' && Boolean(stay.checkInReportId) && !stay.checkOutReportId && (outTiming.isAvailable || outTiming.isEarlyDeparture);

  const completeInventory = async (data: any) => {
    const type = inventory!;
    const report = {
      id: `inv_${type.toLowerCase()}_${stay.id}`, bookingId: stay.id, tenantId: stay.tenantId, ownerId: stay.ownerId,
      type, date: new Date().toISOString(), identityValidated: true, items: [],
      comments: type === 'IN' ? compactCheckinComments(JSON.stringify({ checkinVersion: data.checkinVersion, assessments: data.checkinAssessments })) : JSON.stringify({
        cleaningPolicyVersion: data.cleaningPolicyVersion, checklist: data.checklist, photos: data.photos, incident: data.incidentReport,
        earlyDeparture: data.isEarlyDeparture ? { reason: data.earlyDepartureReason, scheduledDepartureAt: data.scheduledDepartureAt } : undefined,
      }),
      status: 'COMPLETED', roomRating: 0, houseRating: 0, cleanlinessRating: 0, signature: 'OCCUPANT_SIGNED',
      ...(type === 'OUT' ? { isEarlyDeparture: Boolean(data.isEarlyDeparture), ...(data.earlyDepartureReason ? { earlyDepartureReason: data.earlyDepartureReason } : {}), scheduledDepartureAt: data.scheduledDepartureAt } : {}),
    } as const;
    await submitInventoryReport(report as never, (_url, init) => fetch(`/api/stay/${encodeURIComponent(token)}/inventory`, { ...init, headers: { 'Content-Type': 'application/json' } }));
    toast.success(type === 'IN' ? 'État des lieux d’entrée enregistré. Bon séjour !' : 'Départ enregistré. Merci et à bientôt !');
    await load();
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      const { message } = await stayFetch(token, '/messages', { method: 'POST', body: JSON.stringify({ content: draft }) });
      setMessages(previous => [...previous, message]); setDraft('');
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Message non envoyé.'); }
    finally { setSending(false); }
  };

  const author = (message: StayMessage) => message.from === 'OWNER' ? space.ownerFirstName : message.from === 'OCCUPANT' ? 'Vous' : space.bookerFirstName || 'La personne qui a réservé';

  return <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:px-6 md:py-12">
    <header>
      <p className="text-sm text-haven-stone">Espace séjour de {space.occupant.firstName} {space.occupant.lastName}</p>
      <h1 className="mt-2 font-heading text-4xl font-normal leading-tight text-haven-ink sm:text-5xl">{stay.listingTitle}</h1>
      <p className="mt-3 text-gray-600">{stay.roomName} · réservé par {space.bookerName}</p>
    </header>

    <Section icon={CalendarDays} title="Votre séjour">
      <p>Arrivée le <strong className="text-haven-ink">{longDate(stay.startDate)}</strong> à partir de {stay.checkInTime}.</p>
      <p>Départ le <strong className="text-haven-ink">{longDate(stay.endDate)}</strong> avant {stay.checkOutTime}.</p>
      {stay.status === 'COMPLETED' && <p className="mt-3 font-semibold text-haven-ink">Ce séjour est terminé.</p>}
    </Section>

    <Section icon={MapPin} title="Adresse et accès">
      {space.address && <p className="font-semibold text-haven-ink">{space.address}</p>}
      {space.arrivalInformationAvailable ? <div className="mt-3 space-y-3">
        {space.instructions ? <p className="whitespace-pre-line">{space.instructions}</p> : <p>Les consignes d’accès ne sont pas encore renseignées. Écrivez au propriétaire ci-dessous pour organiser la remise des clés.</p>}
        {space.roomGuide?.location && <p><span className="font-semibold text-haven-ink">Votre chambre :</span> {space.roomGuide.location}{space.roomGuide.keyLabel ? ` · clé « ${space.roomGuide.keyLabel} »` : ''}</p>}
        {(space.roomGuide?.doorPhoto || space.roomGuide?.interiorPhoto) && <div className="grid grid-cols-2 gap-3">
          {space.roomGuide.doorPhoto && <img src={space.roomGuide.doorPhoto} alt="Porte de votre chambre" className="aspect-[4/3] w-full rounded-2xl object-cover" />}
          {space.roomGuide.interiorPhoto && <img src={space.roomGuide.interiorPhoto} alt="Intérieur de votre chambre" className="aspect-[4/3] w-full rounded-2xl object-cover" />}
        </div>}
        {space.practicalInfo && <dl className="space-y-3">{PRACTICAL_INFO_FIELDS.filter(({ key }) => space.practicalInfo?.[key]).map(({ key, label }) => <div key={key}>
          <dt className="font-semibold text-haven-ink">{label}</dt><dd className="whitespace-pre-line">{space.practicalInfo![key]}</dd>
        </div>)}</dl>}
      </div> : <p className="mt-2">Les consignes d’accès (code, clés, repères de la chambre) apparaîtront ici le {formatScheduledMoment(new Date(space.instructionsDueAt), stay.timeZone)}. Vous les recevrez aussi par e-mail.</p>}
    </Section>

    <Section icon={ClipboardCheck} title="États des lieux">
      <p>À votre arrivée puis le jour du départ, vérifiez le logement et ajoutez les photos demandées. Ces documents protègent votre séjour et la caution de la personne qui a réservé.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button type="button" disabled={!canCheckIn} onClick={() => setInventory('IN')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-haven-navy px-5 text-sm font-semibold text-white disabled:opacity-40"><KeyRound size={16} aria-hidden="true" />{stay.checkInReportId ? 'Entrée enregistrée' : 'État des lieux d’entrée'}</button>
        <button type="button" disabled={!canCheckOut} onClick={() => setInventory('OUT')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-gray-300 px-5 text-sm font-semibold text-haven-ink disabled:opacity-40"><LogOut size={16} aria-hidden="true" />{stay.checkOutReportId ? 'Départ enregistré' : 'État des lieux de sortie'}</button>
      </div>
      {!stay.checkInReportId && !canCheckIn && !inTiming.isExpired && <p className="mt-3 text-sm text-haven-stone">L’état des lieux d’entrée s’ouvre le {formatScheduledMoment(inTiming.scheduledAt, inTiming.timeZone)}.</p>}
    </Section>

    <Section icon={MessageSquare} title={`Messages avec ${space.ownerFirstName}`}>
      <p className="text-sm text-haven-stone">{space.bookerFirstName || 'La personne qui a réservé'} voit aussi cette conversation.</p>
      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-2xl bg-haven-sand p-4" aria-live="polite">
        {messages.length === 0 ? <p className="text-sm text-haven-stone">Aucun message pour le moment.</p> : messages.map(message => <div key={message.id} className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${message.from === 'OCCUPANT' ? 'ml-auto bg-haven-navy text-white' : 'bg-white text-haven-ink'}`}>
          <p className={`text-xs ${message.from === 'OCCUPANT' ? 'text-white/70' : 'text-haven-stone'}`}>{author(message)} · {new Date(message.timestamp).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p>
          <p className="mt-1 whitespace-pre-line">{message.content}</p>
        </div>)}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor="occupant-message">Votre message</label>
        <textarea id="occupant-message" value={draft} onChange={event => setDraft(event.target.value)} rows={2} maxLength={4999} placeholder="Écrire au propriétaire…" className="min-h-11 flex-1 rounded-2xl border border-gray-200 px-4 py-2.5 text-base focus:border-haven-navy focus:outline-none" />
        <button type="submit" disabled={!draft.trim() || sending} aria-label="Envoyer le message" className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-full bg-haven-navy text-white disabled:opacity-40"><Send size={18} aria-hidden="true" /></button>
      </form>
    </Section>

    <Section icon={AlertTriangle} title="Un problème ?">
      <p>Panne, problème d’accès, propreté : signalez-le. Le propriétaire ou Haven est prévenu selon le problème.</p>
      <button type="button" onClick={() => setReporting(true)} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-gray-300 px-5 text-sm font-semibold text-haven-ink">Signaler un problème</button>
    </Section>

    {space.rules.length > 0 && <Section icon={ClipboardCheck} title="Règles de la maison">
      <ul className="list-disc space-y-1.5 pl-5">{space.rules.map(rule => <li key={rule}>{rule}</li>)}</ul>
    </Section>}

    {inventory && <InventoryModal isOpen withoutAccount onClose={() => setInventory(null)} type={inventory} booking={stay} listing={listing} room={space.room as Room | undefined} onComplete={completeInventory} />}
    <ReportModal isOpen={reporting} onClose={() => setReporting(false)} targetId={stay.id} targetType="TECHNICAL" listingId={stay.listingId} bookingId={stay.id} ownerId={stay.ownerId}
      reporterId={stay.tenantId} submitStayIssue={async input => (await stayFetch(token, '/issues', { method: 'POST', body: JSON.stringify({ ...input, id: input.id || createId() }) })).destination} />
  </div>;
}
