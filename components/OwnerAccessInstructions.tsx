import { useEffect, useState } from 'react';
import { authenticatedFetch } from '../services/serverApi';

export function OwnerAccessInstructions({ listingId }: { listingId: string }) {
  const [instructions, setInstructions] = useState('');
  const [timeZone, setTimeZone] = useState('Europe/Paris');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void authenticatedFetch(`/api/listings/${encodeURIComponent(listingId)}/access-instructions`).then(async response => {
      if (!response.ok) throw new Error('Impossible de charger les consignes.');
      const data = await response.json(); if (active) { setInstructions(data.instructions); setTimeZone(data.timeZone); setLoaded(true); }
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [listingId]);
  const save = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await authenticatedFetch(`/api/listings/${encodeURIComponent(listingId)}/access-instructions`, { method: 'PUT', body: JSON.stringify({ instructions, timeZone }) });
      if (!response.ok) throw new Error('Impossible d’enregistrer les consignes.');
      setMessage('Consignes enregistrées.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-2xl border p-5">
    <h3 className="font-bold text-haven-navy">Consignes privées d’entrée</h3>
    <p className="text-sm text-haven-stone">Indiquez l’accès au bâtiment, la remise des clés et un contact d’arrivée. Ces informations sont réservées aux locataires ayant payé. Elles sont envoyées 72 h avant l’arrivée, ou dès confirmation pour un séjour réservé à moins de 72 h. Les règles du logement sont communes Haven.</p>
    <label className="block text-sm font-bold">Fuseau horaire du logement
      <select disabled={!loaded} className="block w-full rounded-xl border p-3 mt-2" value={timeZone} onChange={event => setTimeZone(event.target.value)}>
        {['Europe/Paris', 'America/Marigot', 'America/Guadeloupe', 'America/Martinique', 'America/Cayenne', 'Indian/Reunion', 'Pacific/Noumea', 'Pacific/Tahiti'].map(zone => <option key={zone} value={zone}>{zone}</option>)}
      </select>
    </label>
    <textarea disabled={!loaded} rows={6} maxLength={6000} value={instructions} onChange={event => setInstructions(event.target.value)} className="w-full rounded-xl border p-4" placeholder="Accès, remise des clés, personne à contacter…" />
    <button type="button" disabled={!loaded || busy} onClick={() => void save()} className="rounded-xl bg-haven-navy text-white px-5 py-3 disabled:opacity-50">{busy ? 'Enregistrement…' : 'Enregistrer les consignes'}</button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
