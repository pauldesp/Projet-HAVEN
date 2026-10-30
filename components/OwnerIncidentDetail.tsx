import { useState } from 'react';
import type { Incident } from '../types';
import { XCircle, Loader2 } from 'lucide-react';
import { HavenFollowUpNotice } from './HavenFollowUpNotice';
import { Button } from './Button';
import { apiService } from '../services/api';

export const incidentStatusLabel = (status: Incident['status']) => ({ NEW: 'À prendre en charge', INVESTIGATING: 'En cours', RESOLVED: 'Résolu', DISMISSED: 'Clôturé' }[status]);

export function OwnerIncidentDetail({ incident, listingTitle, onClose, onUpdated }: {
  incident: Incident; listingTitle: string; onClose: () => void; onUpdated: (update: Partial<Incident>) => void;
}) {
  const [notes, setNotes] = useState(incident.ownerNotes || '');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const isOpen = incident.status === 'NEW' || incident.status === 'INVESTIGATING';
  const update = async (status: 'INVESTIGATING' | 'RESOLVED') => {
    setProcessing(true); setError('');
    try { onUpdated(await apiService.incidents.updateStatus(incident.id, status, notes)); }
    catch (error) { setError(error instanceof Error ? error.message : 'Impossible d’enregistrer le suivi.'); }
    finally { setProcessing(false); }
  };
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-haven-navy/60 p-4 backdrop-blur-sm">
    <section role="dialog" aria-modal="true" aria-labelledby="owner-incident-title" className="haven-dialog-panel flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
      <header className="flex items-center justify-between gap-4 border-b p-6"><div><p className="text-sm text-gray-500">{listingTitle} · {incidentStatusLabel(incident.status)}</p><h2 id="owner-incident-title" className="text-xl font-bold text-haven-navy">{incident.title}</h2></div><button onClick={onClose} disabled={processing} aria-label="Fermer"><XCircle/></button></header>
      <div className="haven-dialog-scroll space-y-5 overflow-y-auto p-6">
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
        <p className="whitespace-pre-wrap text-gray-700">{incident.description}</p>
        <div className="space-y-1 text-sm text-gray-500">
          <p>Déclaré le {new Date(incident.createdAt).toLocaleString('fr-FR')}</p>
          <p>Pris en charge : {incident.takenInChargeAt ? new Date(incident.takenInChargeAt).toLocaleString('fr-FR') : 'Date non renseignée'}</p>
          <p>Résolu : {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString('fr-FR') : 'Date non renseignée'}</p>
          {incident.escalatedAt && <p>Intervention de Haven demandée le {new Date(incident.escalatedAt).toLocaleString('fr-FR')}</p>}
        </div>
        {incident.photos?.map((photo, index) => <img key={index} src={photo} alt={`Photo de l’incident ${index + 1}`} className="max-h-80 w-full rounded-xl object-contain"/>)}
        <HavenFollowUpNotice followUp={incident.havenFollowUp}/>
        <label className="block text-sm font-bold text-haven-navy">Votre suivi<textarea maxLength={2000} rows={4} disabled={!isOpen || processing} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Intervention prévue, actions réalisées…" className="mt-2 w-full rounded-xl border p-3 font-normal"/></label>
        <p className="text-xs text-gray-500">Haven peut consulter le suivi. Vous assurez la prise en charge de cet incident.</p>
      </div>
      <footer className="haven-dialog-footer flex flex-wrap justify-end gap-3 border-t bg-gray-50 p-5">
        {isOpen && <><Button variant="outline" disabled={processing} onClick={() => void update('INVESTIGATING')}>{incident.status === 'NEW' ? 'Prendre en charge' : 'Enregistrer le suivi'}</Button><Button disabled={processing} onClick={() => void update('RESOLVED')}>{processing && <Loader2 size={16} className="mr-2 animate-spin"/>}Marquer comme résolu</Button></>}
        <Button variant="outline" onClick={onClose} disabled={processing}>Fermer</Button>
      </footer>
    </section>
  </div>;
}
