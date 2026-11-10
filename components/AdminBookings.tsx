import { useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Booking, Listing, User } from '../types';
import { apiService } from '../services/api';
import { getCancellationTerms } from '../services/cancellationPolicy';
import { formatEuros } from '../services/money';
import { localDateKey } from '../services/stay';
import { userFacingErrorMessage } from '../services/errorHandling';
import { authenticatedFetch } from '../services/serverApi';

const shortDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Upcoming reserved stays, with a cancellation on behalf of Haven for exceptional cases. */
export function AdminBookings({ bookings, listings, users }: { bookings: Booking[]; listings: Listing[]; users: User[] }) {
  const [search, setSearch] = useState('');
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
  const name = (id: string) => { const user = users.find(item => item.id === id); return user ? `${user.firstName} ${user.lastName}` : `Compte ${id.slice(0, 8)}`; };
  const title = (booking: Booking) => booking.listingTitle || listings.find(item => item.id === booking.listingId)?.title || 'Logement';

  const upcoming = useMemo(() => bookings
    .filter(booking => booking.endDate.slice(0, 10) >= today && (booking.status === 'CONFIRMED' || (booking.status === 'PENDING' && booking.seriesScheduled)))
    .filter(booking => !search.trim() || `${title(booking)} ${booking.roomName} ${name(booking.tenantId)} ${name(booking.ownerId)} ${booking.id}`.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr')))
    .sort((a, b) => a.startDate.localeCompare(b.startDate)), [bookings, search, today, users, listings]);

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
      <h2 className="text-xl font-bold text-haven-navy">Réservations à venir</h2>
      <p className="mt-1 text-sm text-gray-500">Séjours confirmés ou réservés dans une série. Haven peut annuler un séjour jusqu’au jour d’arrivée, par exemple à la demande d’un propriétaire à moins de 30 jours : le locataire est alors remboursé intégralement.</p>
    </div>
    <label className="relative block max-w-md">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
      <span className="sr-only">Rechercher une réservation</span>
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Logement, locataire, propriétaire, référence…" className="h-11 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm" />
    </label>
    <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
      {upcoming.map(booking => (
        <li key={booking.id} className="flex flex-col gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-haven-navy">{title(booking)}{booking.roomName ? ` · ${booking.roomName}` : ''}</p>
            <p className="text-gray-500">{shortDate(booking.startDate)} → {shortDate(booking.endDate)} · {formatEuros(booking.totalPrice)}{booking.paymentStatus !== 'PAID' ? ' · pas encore prélevé' : ''}{booking.paymentIsTest ? ' · test' : ''}</p>
            <p className="text-xs text-gray-400">Locataire : {name(booking.tenantId)} · Propriétaire : {name(booking.ownerId)} · {booking.id}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {!booking.checkInReportId && <button type="button" onClick={() => setMoving({ booking, startDate: booking.startDate, endDate: booking.endDate, roomId: booking.roomId, reason: '' })} className="min-h-11 rounded-xl border border-gray-200 px-4 font-semibold text-haven-navy">Déplacer</button>}
            <button type="button" onClick={() => { setCancelling(booking); setReason(''); }} className="min-h-11 rounded-xl border border-red-100 px-4 font-semibold text-haven-red hover:bg-red-50">Annuler par Haven</button>
          </div>
        </li>
      ))}
      {!upcoming.length && <li className="p-8 text-center text-sm text-gray-500">Aucune réservation à venir{search ? ' pour cette recherche' : ''}.</li>}
    </ul>

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
