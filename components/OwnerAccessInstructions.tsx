import { RoomGuideFields } from './RoomGuideFields';
import { normalizeRoomGuide, type RoomGuide } from '../services/roomGuide';
import { useEffect, useState } from 'react';
import { CarFront, KeyRound, Wifi, Info } from 'lucide-react';
import { authenticatedFetch } from '../services/serverApi';
import { normalizePracticalInfo, PRACTICAL_INFO_FIELDS } from '../services/stayGuide';
import { useLanguage } from '../contexts/LanguageContext';

export function OwnerAccessInstructions({ listingId }: { listingId: string }) {
  const { tr } = useLanguage();
  const [instructions, setInstructions] = useState('');
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const [roomGuides, setRoomGuides] = useState<Record<string, RoomGuide>>({});
  const [photoBusy, setPhotoBusy] = useState(false);
  const [practicalInfo, setPracticalInfo] = useState(() => normalizePracticalInfo(undefined));
  const [timeZone, setTimeZone] = useState('Europe/Paris');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true; setLoaded(false); setMessage('');
    void authenticatedFetch(`/api/listings/${encodeURIComponent(listingId)}/access-instructions`).then(async response => {
      if (!response.ok) throw new Error(tr('Impossible de charger les consignes.'));
      const data = await response.json();
      if (active) { setInstructions(data.instructions); setTimeZone(data.timeZone); setPracticalInfo(normalizePracticalInfo(data.practicalInfo)); setRooms(data.rooms || []); setRoomGuides(data.roomGuides || {}); setLoaded(true); }
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [listingId]);
  const save = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await authenticatedFetch(`/api/listings/${encodeURIComponent(listingId)}/access-instructions`, { method: 'PUT', body: JSON.stringify({ instructions, timeZone, practicalInfo, roomGuides }) });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || tr('Impossible d’enregistrer les consignes.')); }
      setMessage(tr('Guide du séjour enregistré.'));
    } catch (error) { setMessage(error instanceof Error ? error.message : tr('Enregistrement impossible.')); }
    finally { setBusy(false); }
  };
  return <section className="space-y-6 rounded-3xl border border-gray-100 bg-white p-5 sm:p-6">
    <div><h3 className="font-heading text-xl font-bold text-haven-navy">{tr('Guide privé du séjour')}</h3><p className="mt-2 text-sm leading-relaxed text-haven-stone">{tr('Préparez l’arrivée de vos locataires. Ces informations sont disponibles dans leur réservation et dans l’e-mail d’arrivée 72 h avant l’entrée, ou dès confirmation pour une réservation de dernière minute.')}</p></div>
    <fieldset disabled={!loaded || busy || photoBusy} className="space-y-6 disabled:opacity-50">
      <label className="block text-sm font-bold text-haven-navy">{tr('Fuseau horaire du logement')}<select className="mt-2 block w-full rounded-xl border border-gray-200 bg-white p-3 font-normal" value={timeZone} onChange={event => setTimeZone(event.target.value)}>{['Europe/Paris', 'America/Marigot', 'America/Guadeloupe', 'America/Martinique', 'America/Cayenne', 'Indian/Reunion', 'Pacific/Noumea', 'Pacific/Tahiti'].map(zone => <option key={zone} value={zone}>{zone}</option>)}</select></label>
      <div className="rounded-2xl bg-blue-50/60 p-5"><label className="block text-sm font-bold text-haven-navy"><span className="flex items-center gap-2"><KeyRound size={18} />{tr('Accès et remise des clés')}</span><textarea rows={5} maxLength={6000} value={instructions} onChange={event => setInstructions(event.target.value)} className="mt-3 w-full rounded-xl border border-gray-200 bg-white p-3 font-normal" placeholder={tr('Accès au bâtiment, codes, remise des clés, contact d’arrivée…')} /></label></div>
      <div className="space-y-4">
        <div><h4 className="font-bold text-haven-navy">{tr('Identifier chaque chambre')}</h4><p className="mt-2 text-sm leading-relaxed text-gray-500">{tr('Utilisez le même nom ou numéro sur Haven, sur la porte et sur la clé. Ces repères sont privés : chaque locataire reçoit uniquement ceux de sa chambre, 72 h avant son arrivée, ou dès confirmation pour une réservation de dernière minute.')}</p></div>
        {rooms.map(room => <RoomGuideFields key={room.id} name={room.name} value={roomGuides[room.id] || normalizeRoomGuide(undefined)} onChange={guide => setRoomGuides(current => ({ ...current, [room.id]: guide }))} onError={setMessage} onPhotoBusy={setPhotoBusy} />)}
        {!rooms.length && <p className="text-sm text-gray-500">{tr('Ajoutez vos chambres à l’annonce pour renseigner leurs repères.')}</p>}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">{PRACTICAL_INFO_FIELDS.map(({ key, label, limit }) => <label key={key} className={`block text-sm font-bold text-haven-navy ${['parking', 'equipment', 'weeklyCleaning', 'waste', 'usefulInfo'].includes(key) ? 'sm:col-span-2' : ''}`}>
        <span className="flex items-center gap-2">{key === 'parking' ? <CarFront size={18} /> : key.startsWith('wifi') ? <Wifi size={18} /> : <Info size={18} />}{tr(label)}</span>
        {key === 'wifiName' || key === 'wifiPassword' ? <input autoComplete="off" type="text" value={practicalInfo[key]} maxLength={limit} onChange={event => setPracticalInfo(current => ({ ...current, [key]: event.target.value }))} className="mt-2 block w-full rounded-xl border border-gray-200 p-3 font-normal" /> : <textarea rows={3} value={practicalInfo[key]} maxLength={limit} onChange={event => setPracticalInfo(current => ({ ...current, [key]: event.target.value }))} placeholder={tr(key === 'parking' ? 'Où se garer, place attribuée, stationnement gratuit ou payant…' : key === 'equipment' ? 'Chauffage, eau chaude, lave-linge, volets…' : key === 'weeklyCleaning' ? 'Jour, créneau, organisation du passage et espaces entretenus…' : key === 'waste' ? 'Emplacement des bacs, tri, jours de collecte…' : 'Repères pour trouver le logement, transports, commerces, petites astuces…')} className="mt-2 block w-full rounded-xl border border-gray-200 p-3 font-normal" />}
      </label>)}</div>
    </fieldset>
    <p className="rounded-xl bg-haven-cream p-4 text-xs leading-relaxed text-haven-stone">{tr('Ces informations sont privées et ne figurent pas dans l’annonce publique. Les règles communes Haven restent accessibles dans la réservation.')}</p>
    <button type="button" disabled={!loaded || busy || photoBusy} onClick={() => void save()} className="rounded-xl bg-haven-navy px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? tr('Enregistrement…') : tr('Enregistrer le guide du séjour')}</button>
    {message && <p role="status" className="text-sm">{tr(message)}</p>}
  </section>;
}
