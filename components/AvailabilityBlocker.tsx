import { useEffect, useMemo, useState } from 'react';
import { Lock, Loader2, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import type { BookingAvailability, Listing } from '../types';
import { apiService } from '../services/api';
import { useListings } from '../contexts/ListingContext';
import { blockedRanges, datesBetween, withoutDates } from '../services/blockedDates';
import { localDateKey } from '../services/stay';
import { DateRangePicker } from './DateRangePicker';

const BLOCKING = new Set(['PENDING', 'APPROVED', 'CONFIRMED']);
const label = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const nextDay = (date: string) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); };
const dayBefore = (date: string) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() - 1); return value.toISOString().slice(0, 10); };
const errorText = (error: unknown) => error instanceof Error ? error.message.replace(/\s*\(Erreur \d+\)$/, '') : 'Les dates n’ont pas pu être enregistrées.';

/** Owner tool: block a period for the whole listing or one room in a few clicks, saved immediately. */
export function AvailabilityBlocker({ listing, onSaved }: { listing: Listing; onSaved: (target: string, dates: string[]) => void }) {
  const { saveBlockedDates } = useListings();
  const today = localDateKey(new Date());
  const [target, setTarget] = useState('LISTING');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<BookingAvailability[]>([]);
  useEffect(() => { apiService.availability.getByListingId(listing.id).then(setAvailability).catch(() => setAvailability([])); }, [listing.id]);

  const room = listing.rooms.find(item => item.id === target);
  const current = target === 'LISTING' ? listing.blockedDates || [] : room?.blockedDates || [];
  const ranges = useMemo(() => blockedRanges(current).filter(range => range.end >= today), [current, today]);
  const targetName = target === 'LISTING' ? 'tout le logement' : room?.name || 'cette chambre';
  // Same reading as a stay: arrival on the first day, departure on the last one (its night is not blocked).
  const selected = start && end && end > start ? datesBetween(start, dayBefore(end)) : [];
  // Nights already blocked are not counted again; a period entirely blocked cannot be re-blocked.
  const requested = selected.filter(date => !current.includes(date));
  const alreadyBlocked = selected.length - requested.length;
  // The picker shades a period up to its end day included; a single blocked night needs a one-day span to show.
  const blockedAsStays = ranges.map(range => ({ start: range.start, end: range.nights === 1 ? nextDay(range.end) : range.end, label: 'Déjà bloqué' }));
  // Blocking never cancels a reservation: warn when the period already has one.
  const overlapping = requested.length > 0 && availability.some(item => BLOCKING.has(item.status) && (target === 'LISTING' || item.roomId === target)
    && item.startDate < end && item.endDate > start);

  const save = async (dates: string[], message: string) => {
    setSaving(true);
    try {
      await saveBlockedDates(listing.id, target, dates);
      onSaved(target, [...new Set(dates)].sort());
      toast.success(message);
      return true;
    } catch (error) { toast.error(errorText(error)); return false; }
    finally { setSaving(false); }
  };

  const block = async () => {
    if (!requested.length) return;
    if (await save([...new Set([...current, ...requested])], `Dates bloquées pour ${targetName}.`)) { setStart(''); setEnd(''); }
  };

  return <div className="space-y-8">
    <div>
      <h2 className="text-xl font-bold text-haven-ink">Bloquer des dates</h2>
      <p className="mt-1 text-sm text-gray-500">Les dates bloquées ne peuvent plus être réservées. Bloquez tout le logement ou une seule chambre ; l’enregistrement est immédiat.</p>
    </div>

    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Que bloquer ?">
      {[{ id: 'LISTING', name: 'Tout le logement' }, ...listing.rooms.map(item => ({ id: item.id, name: item.name }))].map(option => (
        <button key={option.id} type="button" role="radio" aria-checked={target === option.id} onClick={() => setTarget(option.id)}
          className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${target === option.id ? 'border-haven-navy bg-haven-navy text-white' : 'border-gray-200 bg-white text-haven-ink hover:border-haven-navy/40'}`}>
          {option.name}
        </button>
      ))}
    </div>

    <div>
      <p className="mb-1 text-sm font-semibold text-haven-ink">Période à bloquer</p>
      {/* Field and button share one row so they stay aligned; help texts go below. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        {/* Framed like a field so the date selector stands out on the form. */}
        <div className="flex min-h-12 flex-1 items-center rounded-xl border-2 border-haven-navy/20 bg-white px-3 transition-colors hover:border-haven-navy focus-within:border-haven-navy">
          <DateRangePicker startDate={start} endDate={end} otherStays={blockedAsStays} onChange={(nextStart, nextEnd) => { setStart(nextStart); setEnd(nextEnd); }} />
        </div>
        <button type="button" disabled={!requested.length || saving} onClick={() => void block()} className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-haven-navy px-5 text-sm font-bold text-white disabled:opacity-40">
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
          {requested.length ? `Bloquer ${requested.length} nuit${requested.length > 1 ? 's' : ''}` : 'Bloquer'}
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">Choisissez le premier jour puis le jour de reprise : les nuits entre les deux sont bloquées. Les périodes déjà bloquées apparaissent en rose dans le calendrier.</p>
      {selected.length > 0 && alreadyBlocked > 0 && <p className="mt-1 text-xs font-medium text-amber-700">{requested.length ? `${alreadyBlocked} nuit${alreadyBlocked > 1 ? 's' : ''} déjà bloquée${alreadyBlocked > 1 ? 's' : ''} : seules les ${requested.length} autres seront ajoutées.` : 'Toutes ces nuits sont déjà bloquées.'}</p>}
    </div>
    {overlapping && <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Une réservation existe déjà sur une partie de ces dates. Le blocage ne l’annule pas : il empêche seulement de nouvelles réservations.</p>}

    <section>
      <h3 className="text-sm font-bold text-haven-ink">Dates bloquées · {targetName}</h3>
      {target !== 'LISTING' && (listing.blockedDates || []).some(date => date >= today) && <p className="mt-1 text-xs text-gray-500">Les dates bloquées pour tout le logement s’appliquent aussi à cette chambre.</p>}
      {ranges.length ? <ul className="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-100">
        {ranges.map(range => <li key={range.start} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="text-haven-ink">{range.nights === 1 ? `Nuit du ${label(range.start)}` : `Du ${label(range.start)} au ${label(range.end)} (dernière nuit)`} <span className="text-gray-400">· {range.nights} nuit{range.nights > 1 ? 's' : ''}</span></span>
          <button type="button" disabled={saving} onClick={() => void save(withoutDates(current, datesBetween(range.start, range.end)), `Dates débloquées pour ${targetName}.`)} className="flex min-h-11 shrink-0 items-center gap-1.5 font-semibold text-haven-red disabled:opacity-40">
            <Unlock size={15} aria-hidden="true" /> Débloquer
          </button>
        </li>)}
      </ul> : <p className="mt-3 rounded-2xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-500">Aucune date bloquée à venir.</p>}
    </section>
  </div>;
}
