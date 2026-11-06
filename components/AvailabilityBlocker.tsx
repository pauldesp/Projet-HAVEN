import { useEffect, useMemo, useState } from 'react';
import { Lock, Loader2, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import type { BookingAvailability, Listing } from '../types';
import { apiService } from '../services/api';
import { useListings } from '../contexts/ListingContext';
import { userFacingErrorMessage } from '../services/errorHandling';
import { blockedRanges, datesBetween, withoutDates } from '../services/blockedDates';
import { localDateKey } from '../services/stay';

const BLOCKING = new Set(['PENDING', 'APPROVED', 'CONFIRMED']);
const label = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Owner tool: block a period for the whole listing or one room in a few clicks, saved immediately. */
export function AvailabilityBlocker({ listing, onSaved }: { listing: Listing; onSaved: (target: string, dates: string[]) => void }) {
  const { updateListing } = useListings();
  const today = localDateKey(new Date());
  const [target, setTarget] = useState('LISTING');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<BookingAvailability[]>([]);
  useEffect(() => { apiService.availability.getByListingId(listing.id).then(setAvailability).catch(() => setAvailability([])); }, [listing.id]);

  const room = listing.rooms.find(item => item.id === target);
  const current = target === 'LISTING' ? listing.blockedDates || [] : room?.blockedDates || [];
  const ranges = useMemo(() => blockedRanges(current).filter(range => range.end >= today), [current, today]);
  const targetName = target === 'LISTING' ? 'tout le logement' : room?.name || 'cette chambre';
  const requested = from && to && to >= from ? datesBetween(from, to) : [];
  // Blocking never cancels a reservation: warn when the period already has one.
  const overlapping = requested.length > 0 && availability.some(item => BLOCKING.has(item.status) && (target === 'LISTING' || item.roomId === target)
    && item.startDate <= requested[requested.length - 1] && item.endDate > requested[0]);

  const save = async (dates: string[], message: string) => {
    setSaving(true);
    try {
      // Start from the saved listing so unsaved edits of the form are not published by this action.
      const fresh = await apiService.listings.getById(listing.id);
      if (!fresh) throw new Error('Ce logement n’existe plus.');
      const updated = target === 'LISTING' ? { ...fresh, blockedDates: dates }
        : { ...fresh, rooms: fresh.rooms.map(item => item.id === target ? { ...item, blockedDates: dates } : item) };
      await updateListing(updated);
      onSaved(target, dates);
      toast.success(message);
    } catch (error) { toast.error(userFacingErrorMessage(error)); }
    finally { setSaving(false); }
  };

  const block = async () => {
    if (!requested.length) return;
    await save([...new Set([...current, ...requested])].sort(), `Dates bloquées pour ${targetName}.`);
    setFrom(''); setTo('');
  };

  return <div className="space-y-8">
    <div>
      <h2 className="text-xl font-bold text-haven-navy">Bloquer des dates</h2>
      <p className="mt-1 text-sm text-gray-500">Les dates bloquées ne peuvent plus être réservées. Bloquez tout le logement ou une seule chambre ; l’enregistrement est immédiat.</p>
    </div>

    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Que bloquer ?">
      {[{ id: 'LISTING', name: 'Tout le logement' }, ...listing.rooms.map(item => ({ id: item.id, name: item.name }))].map(option => (
        <button key={option.id} type="button" role="radio" aria-checked={target === option.id} onClick={() => setTarget(option.id)}
          className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${target === option.id ? 'border-haven-navy bg-haven-navy text-white' : 'border-gray-200 bg-white text-haven-navy hover:border-haven-navy/40'}`}>
          {option.name}
        </button>
      ))}
    </div>

    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="text-sm font-semibold text-haven-navy">Du
        <input type="date" min={today} value={from} onChange={event => { setFrom(event.target.value); if (!to || to < event.target.value) setTo(event.target.value); }} className="mt-1 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" />
      </label>
      <label className="text-sm font-semibold text-haven-navy">Au (inclus)
        <input type="date" min={from || today} value={to} onChange={event => setTo(event.target.value)} className="mt-1 h-12 w-full rounded-xl border border-gray-200 px-3 font-normal" />
      </label>
      <button type="button" disabled={!requested.length || saving} onClick={() => void block()} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-haven-navy px-5 text-sm font-bold text-white disabled:opacity-40">
        {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
        {requested.length ? `Bloquer ${requested.length} nuit${requested.length > 1 ? 's' : ''}` : 'Bloquer'}
      </button>
    </div>
    {overlapping && <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Une réservation existe déjà sur une partie de ces dates. Le blocage ne l’annule pas : il empêche seulement de nouvelles réservations.</p>}

    <section>
      <h3 className="text-sm font-bold text-haven-navy">Dates bloquées · {targetName}</h3>
      {target !== 'LISTING' && (listing.blockedDates || []).some(date => date >= today) && <p className="mt-1 text-xs text-gray-500">Les dates bloquées pour tout le logement s’appliquent aussi à cette chambre.</p>}
      {ranges.length ? <ul className="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-100">
        {ranges.map(range => <li key={range.start} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="text-haven-navy">{range.start === range.end ? label(range.start) : `Du ${label(range.start)} au ${label(range.end)}`} <span className="text-gray-400">· {range.nights} nuit{range.nights > 1 ? 's' : ''}</span></span>
          <button type="button" disabled={saving} onClick={() => void save(withoutDates(current, datesBetween(range.start, range.end)), `Dates débloquées pour ${targetName}.`)} className="flex min-h-11 shrink-0 items-center gap-1.5 font-semibold text-haven-red disabled:opacity-40">
            <Unlock size={15} aria-hidden="true" /> Débloquer
          </button>
        </li>)}
      </ul> : <p className="mt-3 rounded-2xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">Aucune date bloquée à venir.</p>}
    </section>
  </div>;
}
