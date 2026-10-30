import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Loader2, XCircle } from 'lucide-react';
import type { Incident, Listing, User } from '../types';
import { HavenFollowUpNotice } from './HavenFollowUpNotice';
import { Button } from './Button';
import { apiService } from '../services/api';
import { toast } from 'sonner';
import { filterAndSortIncidents, initialIncidentFilter, isOpenIncident, type IncidentFilter } from '../services/incidentMonitoring';
import { incidentStatusLabel } from './OwnerIncidentDetail';

const date = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'Non renseignée';
export function IncidentMonitor({ incidents, listings, users = [], tenant = false, error }: {
  incidents: Incident[]; listings: Listing[]; users?: User[]; tenant?: boolean; error?: string;
}) {
  const [filter, setFilter] = useState<IncidentFilter>(initialIncidentFilter);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [escalating, setEscalating] = useState<Incident | null>(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sent, setSent] = useState<string[]>([]);
  const listingOf = (incident: Incident) => listings.find(item => item.id === incident.listingId);
  const listingName = (incident: Incident) => listingOf(incident)?.title || 'Logement non renseigné';
  const ownerId = (incident: Incident) => incident.ownerId || listingOf(incident)?.ownerId || '';
  const userName = (id: string) => { const user = users.find(item => item.id === id); return user ? `${user.firstName} ${user.lastName}` : id ? `Compte ${id.slice(0, 8)}` : 'Non renseigné'; };
  const hydrated = incidents.map(item => ({ ...item, ownerId: ownerId(item) }));
  const filtered = filterAndSortIncidents(hydrated, filter, item => `${listingName(item)} ${userName(ownerId(item))} ${userName(item.reporterId)}`);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 15));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 15, currentPage * 15);
  const change = (update: Partial<IncidentFilter>) => { setFilter(previous => ({ ...previous, ...update })); setPage(1); };
  const owners = Array.from(new Set(hydrated.map(item => item.ownerId).filter(Boolean)));
  const relevantListings = listings.filter(item => incidents.some(incident => incident.listingId === item.id));
  const extraFilterCount = [filter.listingId, !tenant && filter.ownerId, filter.from, filter.to].filter(Boolean).length;
  const submit = async () => {
    if (!escalating || !reason.trim() || sending) return;
    setSending(true); setSendError('');
    try {
      await apiService.incidents.escalate(escalating.id, reason);
      setSent(previous => [...previous, escalating.id]); setEscalating(null);
      toast.success('Votre demande a été transmise à Haven.');
    } catch (error) { setSendError(error instanceof Error ? error.message : 'Impossible de transmettre la demande.'); }
    finally { setSending(false); }
  };
  return <section className="space-y-5">
    <div><h2 className="text-xl font-bold text-haven-navy">{tenant ? 'Mes incidents' : 'Suivi des incidents'}</h2><p className="mt-1 text-sm text-gray-500">{tenant ? 'Suivez les réponses du propriétaire. Vous pouvez demander l’intervention de Haven si le problème persiste.' : 'Les propriétaires gèrent ces incidents. Haven consulte leur avancement et intervient uniquement lorsqu’un signalement lui est transmis.'}</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 w-full sm:min-w-[200px] flex-1 text-xs font-semibold text-gray-500">Rechercher<input value={filter.search} onChange={event => change({ search: event.target.value })} placeholder="Incident, logement ou personne…" className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal"/></label>
      <label className="w-full sm:w-44 text-xs font-semibold text-gray-500">Statut<select value={filter.status} onChange={event => change({ status: event.target.value as IncidentFilter['status'] })} className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal">
        <option value="OPEN">Non résolus ({incidents.filter(isOpenIncident).length})</option>
        <option value="NEW">À prendre en charge</option><option value="INVESTIGATING">En cours</option><option value="RESOLVED">Résolus</option><option value="ESCALATED">Signalés à Haven</option><option value="DISMISSED">Clôturés</option><option value="ALL">Tous les incidents</option>
      </select></label>
      <label className="w-full sm:w-44 text-xs font-semibold text-gray-500">Trier par<select value={filter.sort} onChange={event => change({ sort: event.target.value as IncidentFilter['sort'] })} className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal"><option value="OLDEST">Plus anciens</option><option value="NEWEST">Plus récents</option><option value="PRIORITY">Priorité</option><option value="RESOLVED">Dernières résolutions</option></select></label>
    </div>
    <details className="rounded-xl border border-gray-100 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-gray-600">Plus de filtres{extraFilterCount > 0 && ` (${extraFilterCount} actifs)`}</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-gray-500">Logement<select value={filter.listingId} onChange={event => change({ listingId: event.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"><option value="">Tous les logements</option>{relevantListings.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        {!tenant && <label className="text-xs font-semibold text-gray-500">Propriétaire<select value={filter.ownerId} onChange={event => change({ ownerId: event.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"><option value="">Tous les propriétaires</option>{owners.map(id => <option key={id} value={id}>{userName(id)}</option>)}</select></label>}
        <label className="text-xs font-semibold text-gray-500">Du<input type="date" value={filter.from} onChange={event => change({ from: event.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"/></label>
        <label className="text-xs font-semibold text-gray-500">Au<input type="date" value={filter.to} onChange={event => change({ to: event.target.value })} className="mt-1 h-11 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"/></label>
      </div>
    </details>
    <div className="flex items-center justify-between text-sm text-gray-500"><span>{filtered.length} résultat(s)</span>{Object.keys(initialIncidentFilter).some(key => filter[key as keyof IncidentFilter] !== initialIncidentFilter[key as keyof IncidentFilter]) && <button className="text-xs font-semibold text-haven-navy" onClick={() => { setFilter(initialIncidentFilter); setPage(1); }}>Effacer les filtres</button>}</div>
    <div className="overflow-x-auto rounded-2xl border border-gray-100">
      <table className="haven-table w-full text-left text-sm"><thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="p-4">Incident / logement</th>{!tenant && <th className="p-4">Propriétaire</th>}<th className="p-4">Avancement</th><th className="whitespace-nowrap p-4">Déclaré le</th><th className="whitespace-nowrap p-4">Pris en charge le</th><th className="whitespace-nowrap p-4">Résolu le</th><th className="p-4">Détails</th></tr></thead>
      <tbody className="divide-y divide-gray-100">{visible.map(incident => <React.Fragment key={incident.id}>
        <tr className="hover:bg-gray-50"><td data-label="Incident / logement" className="min-w-[200px] p-4"><p className="font-bold text-haven-navy">{incident.title}</p><p className="mt-1 text-xs text-gray-500">{listingName(incident)}</p><p className="mt-1 text-xs text-gray-400">Priorité : {incident.priority === 'HIGH' ? 'Urgente' : incident.priority === 'LOW' ? 'Basse' : 'Moyenne'}</p></td>{!tenant && <td data-label="Propriétaire" className="p-4 text-gray-600">{userName(incident.ownerId)}</td>}<td data-label="Avancement" className="p-4"><span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs ${incident.status === 'RESOLVED' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{incidentStatusLabel(incident.status)}</span>{incident.escalatedAt && <p className="mt-2 text-xs text-haven-red">Signalé à Haven le {date(incident.escalatedAt)}</p>}</td><td data-label="Déclaré le" className="whitespace-nowrap p-4 text-xs">{date(incident.createdAt)}</td><td data-label="Pris en charge le" className="whitespace-nowrap p-4 text-xs">{date(incident.takenInChargeAt)}</td><td data-label="Résolu le" className="whitespace-nowrap p-4 text-xs">{date(incident.resolvedAt)}</td><td data-label="Détails" className="p-4"><button aria-label={`Détails de ${incident.title}`} aria-expanded={expanded === incident.id} onClick={() => setExpanded(expanded === incident.id ? null : incident.id)} className="haven-touch-action rounded-lg border p-2">{expanded === incident.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button></td></tr>
        {expanded === incident.id && <tr><td colSpan={tenant ? 6 : 7} className="bg-gray-50 p-5"><div className="space-y-4"><p className="whitespace-pre-wrap text-gray-700">{incident.description}</p><p className="text-xs text-gray-500">Référence : {incident.id}{!tenant && ` · Déclaré par : ${userName(incident.reporterId)}`} · Dernière mise à jour : {date(incident.updatedAt)}</p><HavenFollowUpNotice followUp={incident.havenFollowUp}/>{incident.ownerNotes && <p className="rounded-xl bg-white p-4 text-sm text-gray-600">Suivi du propriétaire : {incident.ownerNotes}</p>}<div className="flex flex-wrap gap-3">{incident.photos?.map((photo, index) => <img key={index} src={photo} alt={`Incident, photo ${index + 1}`} className="max-h-56 max-w-full rounded-xl object-contain"/>)}</div><div className="flex flex-wrap items-center gap-3"><Link to={`/listing/${incident.listingId}`} className="text-sm font-bold text-haven-navy underline">Voir le logement</Link>{tenant && isOpenIncident(incident) && (incident.escalationReportId || sent.includes(incident.id) ? <span className="text-sm text-gray-500">Demande déjà transmise à Haven</span> : <Button variant="outline" onClick={() => { setEscalating(incident); setReason(''); setSendError(''); }}>Demander l’intervention de Haven</Button>)}</div></div></td></tr>}
      </React.Fragment>)}</tbody></table>
      {!visible.length && <p className="p-10 text-center text-sm text-gray-500">Aucun incident ne correspond à ces filtres.</p>}
    </div>
    <div className="flex items-center justify-end gap-3 text-sm"><Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Précédent</Button><span>{currentPage} / {pageCount}</span><Button variant="outline" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Suivant</Button></div>
    {escalating && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-haven-navy/60 p-4"><section role="dialog" aria-modal="true" aria-labelledby="escalation-title" className="haven-dialog-panel haven-dialog-scroll w-full max-w-lg space-y-5 rounded-3xl bg-white p-6"><div className="flex items-center justify-between gap-3"><h3 id="escalation-title" className="text-xl font-bold text-haven-navy">Demander l’intervention de Haven</h3><button aria-label="Fermer" disabled={sending} onClick={() => setEscalating(null)}><XCircle/></button></div><p className="text-sm text-gray-600">{escalating.title}. Le problème persiste ? Expliquez à Haven ce qui reste sans solution. Le propriétaire continue de gérer l’incident.</p><textarea aria-label="Motif de la demande" rows={5} maxLength={2000} value={reason} disabled={sending} onChange={event => setReason(event.target.value)} className="w-full rounded-xl border p-3" placeholder="Décrivez la situation et vos échanges avec le propriétaire…"/>{sendError && <p role="alert" className="text-sm text-red-600">{sendError}</p>}<Button fullWidth disabled={sending || !reason.trim()} onClick={() => void submit()}>{sending && <Loader2 className="mr-2 animate-spin" size={16}/>}Envoyer le signalement à Haven</Button></section></div>}
  </section>;
}
