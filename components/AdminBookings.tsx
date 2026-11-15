import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ClipboardCheck, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Booking, Listing, User } from '../types';
import { apiService } from '../services/api';
import { getCancellationTerms } from '../services/cancellationPolicy';
import { formatEuros } from '../services/money';
import { countNights, localDateKey } from '../services/stay';
import { userFacingErrorMessage } from '../services/errorHandling';
import { authenticatedFetch } from '../services/serverApi';

const shortDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

type View = 'CURRENT' | 'UPCOMING' | 'PAST' | 'CANCELLED' | 'ALL';
type SortKey = 'startDate' | 'endDate' | 'listing' | 'tenant' | 'owner' | 'amount' | 'nights';
const VIEWS: [View, string][] = [['CURRENT', 'En cours'], ['UPCOMING', 'À venir'], ['PAST', 'Terminés'], ['CANCELLED', 'Annulés'], ['ALL', 'Tous']];

/** Every stay: current, upcoming, past or cancelled, sortable, with the stay file and Haven's exceptional actions. */
export function AdminBookings({ bookings, listings, users, onOpenCase }: { bookings: Booking[]; listings: Listing[]; users: User[]; onOpenCase: (bookingId: string) => void }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('CURRENT');
  const [listingFilter, setListingFilter] = useState('');
  const [includeTests, setIncludeTests] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({ key: 'startDate', ascending: true });
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [moving, setMoving] = useState<{ booking: Booking; startDate: string; endDate: string; roomId: string; reason: string } | null>(null);
  const move = async () => {
    if (!moving || sending) return;
    setSending(true);
    try {
      const response = await authenticatedFetch(`/api/admin/bookings/${moving.booking.id}/move`, { method: 'POST', body: JSON.stringify({ startDate: moving.startDate, endDate: moving.endDate, roomId: moving.roomId, reason: moving.reason }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Déplacement impossible.');
      toast.success('Séjour déplacé. Prévenez le locataire et le propriétaire depuis la messagerie ou par téléphone.');
      setMoving(null);
    } catch (error) { toast.error(userFacingErrorMessage(error)); }
    finally { setSending(false); }
  };
  const today = localDateKey(new Date());
  // Old test bookings may lack a tenant or owner: never let one record break the whole tab.
  const name = (id?: string) => { if (!id) return 'Inconnu'; const user = users.find(item => item.id === id); return user ? `${user.firstName} ${user.lastName}` : `Compte ${id.slice(0, 8)}`; };
  const title = (booking: Booking) => booking.listingTitle || listings.find(item => item.id === booking.listingId)?.title || 'Logement';

  // A stay counts as held once paid, or reserved in a series (charged later).
  const held = (booking: Booking) => booking.status === 'CONFIRMED' || booking.status === 'COMPLETED' || (booking.status === 'PENDING' && Boolean(booking.seriesScheduled));
  const viewOf = (booking: Booking): View | null => {
    if (booking.status === 'CANCELLED') return 'CANCELLED';
    if (!held(booking)) return null; // Abandoned or unpaid checkouts are not stays.
    if (booking.status === 'COMPLETED' || booking.endDate.slice(0, 10) < today) return 'PAST';
    return booking.startDate.slice(0, 10) <= today ? 'CURRENT' : 'UPCOMING';
  };
  const counts = useMemo(() => {
    const result: Record<View, number> = { CURRENT: 0, UPCOMING: 0, PAST: 0, CANCELLED: 0, ALL: 0 };
    for (const booking of bookings) { if (!includeTests && booking.paymentIsTest) continue; const value = viewOf(booking); if (value) { result[value] += 1; result.ALL += 1; } }
    return result;
  }, [bookings, today, includeTests]);
  const sortValue = (booking: Booking): string | number => ({
    startDate: booking.startDate, endDate: booking.endDate, listing: `${title(booking)} ${booking.roomName || ''}`.toLocaleLowerCase('fr'),
    tenant: name(booking.tenantId).toLocaleLowerCase('fr'), owner: name(booking.ownerId).toLocaleLowerCase('fr'), amount: booking.totalPrice, nights: countNights(booking.startDate, booking.endDate),
  })[sort.key];
  const shown = useMemo(() => bookings
    .filter(booking => { const value = viewOf(booking); return value !== null && (view === 'ALL' || value === view); })
    .filter(booking => includeTests || !booking.paymentIsTest)
    .filter(booking => !listingFilter || booking.listingId === listingFilter)
    .filter(booking => !search.trim() || `${title(booking)} ${booking.roomName} ${name(booking.tenantId)} ${name(booking.ownerId)} ${booking.id}`.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr')))
    .sort((a, b) => { const x = sortValue(a), y = sortValue(b); const order = x < y ? -1 : x > y ? 1 : 0; return sort.ascending ? order : -order; }),
  [bookings, search, today, users, listings, view, listingFilter, includeTests, sort]);
  const chooseView = (value: View) => { setView(value); setSort({ key: 'startDate', ascending: value === 'UPCOMING' || value === 'CURRENT' }); };
  const sortBy = (key: SortKey) => setSort(current => ({ key, ascending: current.key === key ? !current.ascending : key !== 'amount' }));
  const SortHeader = ({ label, sortKey }: { label: string; sortKey: SortKey }) => <th className="p-3 text-left">
    <button type="button" onClick={() => sortBy(sortKey)} className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-500 hover:text-haven-navy">
      {label}{sort.key === sortKey && (sort.ascending ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  </th>;
  const stayState = (booking: Booking) => {
    if (booking.status === 'CANCELLED') return { label: 'Annulé', tone: 'bg-gray-100 text-gray-600' };
    if (booking.status === 'PENDING') return { label: 'Prélèvement à venir', tone: 'bg-amber-50 text-amber-700' };
    const value = viewOf(booking);
    if (value === 'PAST') return booking.checkOutReportId ? { label: 'Terminé', tone: 'bg-green-50 text-green-700' } : { label: 'Terminé sans sortie', tone: 'bg-amber-50 text-amber-700' };
    if (value === 'CURRENT') return booking.checkInReportId ? { label: 'En cours', tone: 'bg-blue-50 text-blue-700' } : { label: 'Entrée non faite', tone: 'bg-amber-50 text-amber-700' };
    return { label: 'Confirmé', tone: 'bg-green-50 text-green-700' };
  };
  const ownedListings = useMemo(() => [...listings].sort((a, b) => a.title.localeCompare(b.title, 'fr')), [listings]);

  const terms = cancelling ? getCancellationTerms(cancelling, 'HAVEN') : null;
  const confirm = async () => {
    if (!cancelling || reason.trim().length < 3 || sending) return;
    setSending(true);
    try {
      await apiService.bookings.cancel(cancelling.id, `Annulation par Haven : ${reason.trim()}`);
      toast.success('Réservation annulée. Le locataire et le propriétaire sont prévenus par e-mail.');
      setCancelling(null); setReason('');
    } catch (error) { toast.error(userFacingErrorMessage(error)); }
    finally { setSending(false); }
  };

  return <section className="space-y-5">
    <div>
      <h2 className="text-xl font-bold text-haven-navy">Réservations</h2>
      <p className="mt-1 text-sm text-gray-500">Cliquez sur un séjour pour ouvrir son dossier : personnes, états des lieux, séjour précédent dans la chambre, signalements et versement. Haven peut déplacer un séjour avant l’entrée ou l’annuler jusqu’au jour d’arrivée (locataire remboursé intégralement).</p>
    </div>
    <nav className="flex flex-wrap gap-2" aria-label="Période des séjours">
      {VIEWS.map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => chooseView(id)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${view === id ? 'border-haven-navy bg-haven-navy text-white' : 'border-gray-200 text-haven-navy'}`}>{label} <span className={view === id ? 'text-white/70' : 'text-gray-400'}>{counts[id]}</span></button>)}
    </nav>
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <label className="relative block flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <span className="sr-only">Rechercher une réservation</span>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Logement, locataire, propriétaire, référence…" className="h-11 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm" />
      </label>
      <label className="text-sm"><span className="sr-only">Logement</span>
        <select value={listingFilter} onChange={event => setListingFilter(event.target.value)} className="h-11 w-full rounded-xl border border-gray-200 px-3 lg:w-64">
          <option value="">Tous les logements</option>
          {ownedListings.map(listing => <option key={listing.id} value={listing.id}>{listing.title}</option>)}
        </select>
      </label>
      {/* On phones the column headers are hidden: sorting goes through this list. */}
      <label className="text-sm md:hidden"><span className="sr-only">Trier</span>
        <select value={`${sort.key}:${sort.ascending ? 'asc' : 'desc'}`} onChange={event => { const [key, direction] = event.target.value.split(':'); setSort({ key: key as SortKey, ascending: direction === 'asc' }); }} className="h-11 w-full rounded-xl border border-gray-200 px-3">
          <option value="startDate:asc">Arrivée, la plus proche d’abord</option>
          <option value="startDate:desc">Arrivée, la plus récente d’abord</option>
          <option value="endDate:asc">Départ, le plus proche d’abord</option>
          <option value="endDate:desc">Départ, le plus récent d’abord</option>
          <option value="amount:desc">Montant décroissant</option>
          <option value="listing:asc">Logement (A → Z)</option>
          <option value="tenant:asc">Locataire (A → Z)</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={includeTests} onChange={event => setIncludeTests(event.target.checked)} />Inclure les tests</label>
    </div>

    <div className="overflow-x-auto rounded-2xl border border-gray-100">
      <table className="haven-table w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <SortHeader label="Logement" sortKey="listing" />
            <SortHeader label="Arrivée" sortKey="startDate" />
            <SortHeader label="Départ" sortKey="endDate" />
            <SortHeader label="Nuits" sortKey="nights" />
            <SortHeader label="Locataire" sortKey="tenant" />
            <SortHeader label="Propriétaire" sortKey="owner" />
            <SortHeader label="Montant" sortKey="amount" />
            <th className="p-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500">État</th>
            <th className="p-3"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {shown.map(booking => {
            const state = stayState(booking);
            const upcoming = booking.status !== 'CANCELLED' && booking.endDate.slice(0, 10) >= today && booking.status !== 'COMPLETED';
            return <tr key={booking.id} onClick={() => onOpenCase(booking.id)} className="cursor-pointer align-top hover:bg-gray-50">
              <td data-label="Logement" className="p-3"><p className="font-semibold text-haven-navy">{title(booking)}</p><p className="text-xs text-gray-500">{booking.roomName || 'Chambre'}{booking.seriesId ? ` · série ${(booking.seriesIndex ?? 0) + 1}/${booking.seriesCount}` : ''}{booking.paymentIsTest ? ' · test' : ''}</p></td>
              <td data-label="Arrivée" className="whitespace-nowrap p-3">{shortDate(booking.startDate)}</td>
              <td data-label="Départ" className="whitespace-nowrap p-3">{shortDate(booking.endDate)}</td>
              <td data-label="Nuits" className="p-3">{countNights(booking.startDate, booking.endDate)}</td>
              <td data-label="Locataire" className="p-3">{name(booking.tenantId)}</td>
              <td data-label="Propriétaire" className="p-3">{name(booking.ownerId)}</td>
              <td data-label="Montant" className="whitespace-nowrap p-3 font-semibold">{formatEuros(booking.totalPrice)}</td>
              <td data-label="État" className="p-3">
                <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${state.tone}`}>{state.label}</span>
                {booking.status !== 'CANCELLED' && <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-500"><ClipboardCheck size={12} />Entrée {booking.checkInReportId ? '✓' : '—'} · Sortie {booking.checkOutReportId ? '✓' : '—'}</p>}
              </td>
              <td data-label="Actions" className="p-3" onClick={event => event.stopPropagation()}>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => onOpenCase(booking.id)} className="min-h-9 whitespace-nowrap rounded-lg bg-haven-navy px-3 text-xs font-bold text-white">Dossier</button>
                  {upcoming && !booking.checkInReportId && <button type="button" onClick={() => setMoving({ booking, startDate: booking.startDate, endDate: booking.endDate, roomId: booking.roomId, reason: '' })} className="min-h-9 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-haven-navy">Déplacer</button>}
                  {upcoming && <button type="button" onClick={() => { setCancelling(booking); setReason(''); }} className="min-h-9 whitespace-nowrap rounded-lg border border-red-100 px-3 text-xs font-semibold text-haven-red hover:bg-red-50">Annuler</button>}
                </div>
              </td>
            </tr>;
          })}
          {!shown.length && <tr><td colSpan={9} className="p-8 text-center text-sm text-gray-500">Aucun séjour dans cette catégorie{search || listingFilter ? ' pour ces filtres' : ''}.</td></tr>}
        </tbody>
      </table>
    </div>

    {moving && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-haven-navy/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="move-title" className="haven-dialog-panel w-full max-w-lg space-y-4 rounded-3xl bg-white p-6">
        <h3 id="move-title" className="text-xl font-bold text-haven-navy">Déplacer ce séjour</h3>
        <p className="text-sm text-gray-600">{title(moving.booking)} · actuellement du {shortDate(moving.booking.startDate)} au {shortDate(moving.booking.endDate)}. Même nombre de nuits, prix inchangé ; les consignes d’arrivée et le rappel de départ suivent les nouvelles dates.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold text-haven-navy">Arrivée<input type="date" value={moving.startDate} onChange={event => setMoving({ ...moving, startDate: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
          <label className="text-sm font-semibold text-haven-navy">Départ<input type="date" value={moving.endDate} onChange={event => setMoving({ ...moving, endDate: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" /></label>
        </div>
        <label className="block text-sm font-semibold text-haven-navy">Chambre
          <select value={moving.roomId} onChange={event => setMoving({ ...moving, roomId: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal">
            {(listings.find(item => item.id === moving.booking.listingId)?.rooms || []).map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-haven-navy">Motif (journal d’administration)<textarea value={moving.reason} onChange={event => setMoving({ ...moving, reason: event.target.value })} rows={2} maxLength={300} className="mt-1 w-full rounded-xl border border-gray-200 p-3 font-normal" /></label>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={sending} onClick={() => setMoving(null)} className="min-h-11 rounded-xl px-4 font-semibold text-gray-600 hover:bg-gray-100">Retour</button>
          <button type="button" disabled={sending || moving.reason.trim().length < 3} onClick={() => void move()} className="min-h-11 rounded-xl bg-haven-navy px-4 font-bold text-white disabled:opacity-40">{sending ? 'Déplacement…' : 'Déplacer le séjour'}</button>
        </div>
      </section>
    </div>}

    {cancelling && terms && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-haven-navy/60 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="haven-cancel-title" className="haven-dialog-panel w-full max-w-lg space-y-4 rounded-3xl bg-white p-6">
        <h3 id="haven-cancel-title" className="text-xl font-bold text-haven-navy">Annuler ce séjour au nom de Haven</h3>
        <p className="text-sm text-gray-600">{title(cancelling)} · {shortDate(cancelling.startDate)} → {shortDate(cancelling.endDate)}<br />Locataire : {name(cancelling.tenantId)}</p>
        <p className={`rounded-xl p-3 text-sm ${terms.canCancel ? 'bg-gray-50 text-gray-700' : 'bg-red-50 text-red-700'}`}>{terms.canCancel ? `${terms.label} : ${formatEuros(terms.refundAmount)}. ${terms.detail}` : terms.detail}</p>
        <label className="block text-sm font-semibold text-haven-navy">Motif (transmis au locataire et au propriétaire)
          <textarea value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={400} className="mt-1 w-full rounded-xl border border-gray-200 p-3 font-normal" placeholder="Ex. : demande du propriétaire suite à un dégât des eaux" />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={sending} onClick={() => setCancelling(null)} className="min-h-11 rounded-xl px-4 font-semibold text-gray-600 hover:bg-gray-100">Retour</button>
          <button type="button" disabled={!terms.canCancel || reason.trim().length < 3 || sending} onClick={() => void confirm()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-haven-red px-4 font-bold text-white disabled:opacity-40">
            {sending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}Confirmer l’annulation
          </button>
        </div>
      </section>
    </div>}
  </section>;
}
