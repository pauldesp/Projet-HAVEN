import { askText } from './HavenDialogs';
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authenticatedFetch } from '../services/serverApi';
import { formatEuros } from '../services/money';
import type { MemberFile } from '../services/memberFile';

const KIND_LABEL: Record<string, string> = { BOOKING: 'Séjour', PAYMENT: 'Paiement', PAYOUT: 'Virement', REPORT: 'Signalement', INCIDENT: 'Incident', REVIEW: 'Avis', MAIL: 'E-mail', ADMIN: 'Haven', NOTE: 'Note' };
const when = (value: string) => new Date(value).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** 360° view of a member for the Haven team: key figures, internal notes and full timeline. */
export function AdminMemberFile({ userId }: { userId: string }) {
  const [file, setFile] = useState<MemberFile | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const load = useCallback(async () => {
    setError('');
    try {
      const response = await authenticatedFetch(`/api/admin/users/${encodeURIComponent(userId)}/file`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fiche indisponible.');
      setFile(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Fiche indisponible.'); }
  }, [userId]);
  useEffect(() => { setFile(null); void load(); }, [load]);

  const addNote = async () => {
    if (note.trim().length < 2 || saving) return;
    setSaving(true);
    try {
      const response = await authenticatedFetch(`/api/admin/users/${encodeURIComponent(userId)}/notes`, { method: 'POST', body: JSON.stringify({ text: note }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Note non enregistrée.');
      setNote(''); await load();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Note non enregistrée.'); }
    finally { setSaving(false); }
  };

  const exportData = async () => {
    try {
      const response = await authenticatedFetch(`/api/admin/users/${encodeURIComponent(userId)}/export`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Export impossible.');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      link.download = `haven-donnees-${userId}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Export impossible.'); }
  };
  const erase = async () => {
    const confirm = await askText({ title: 'Effacer ce compte ?', message: 'Effacement définitif : le compte sera anonymisé et ne pourra plus se connecter.', label: 'Tapez EFFACER pour confirmer', mustEqual: 'EFFACER', confirmLabel: 'Effacer', danger: true });
    if (confirm !== 'EFFACER') return;
    try {
      const response = await authenticatedFetch(`/api/admin/users/${encodeURIComponent(userId)}/erase`, { method: 'POST', body: JSON.stringify({ confirm }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Effacement impossible.');
      toast.success('Compte effacé et anonymisé.'); await load();
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Effacement impossible.'); }
  };

  if (error) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!file) return <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Chargement de la fiche complète…</p>;
  const { counters } = file;
  const events = filter === 'ALL' ? file.events : file.events.filter(event => event.kind === filter);

  return <section className="space-y-6 border-t border-gray-100 pt-6">
    <AdminTaxProfile userId={userId} />
    <h4 className="font-heading text-xl font-normal text-haven-ink">Fiche complète</h4>
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[['Séjours payés (locataire)', String(counters.stays)], ['Séjours reçus (propriétaire)', String(counters.ownerStays)], ['Annulations', String(counters.cancelled)],
        ['Payé net comme locataire', formatEuros(counters.paidAsTenant)], ['Versé comme propriétaire', formatEuros(counters.earnedAsOwner)], ['Avis', String(counters.reviews)],
        ['Signalements envoyés', String(counters.reportsMade)], ['Signalements le concernant', String(counters.reportsReceived)], ['Incidents', String(counters.incidents)]].map(([label, value]) => (
        <div key={label} className="rounded-xl border border-gray-100 p-3"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 font-bold text-haven-ink">{value}</dd></div>
      ))}
    </dl>

    <div className="space-y-3">
      <h5 className="font-bold text-haven-ink">Notes internes de l’équipe</h5>
      <p className="text-xs text-gray-500">Visibles uniquement par les administrateurs. Elles ne peuvent pas être modifiées après enregistrement.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea value={note} onChange={event => setNote(event.target.value)} rows={2} maxLength={2000} placeholder="Ex. : appel le 12/11, propriétaire prévenu du retard de versement" className="min-h-11 flex-1 rounded-xl border border-gray-200 p-3 text-sm" />
        <button type="button" disabled={note.trim().length < 2 || saving} onClick={() => void addNote()} className="min-h-11 rounded-xl bg-haven-navy px-4 text-sm font-bold text-white disabled:opacity-40">{saving ? 'Enregistrement…' : 'Ajouter'}</button>
      </div>
      <ul className="space-y-2">
        {file.notes.map(item => <li key={item.id} className="rounded-xl bg-amber-50 p-3 text-sm"><p className="whitespace-pre-wrap text-gray-800">{item.text}</p><p className="mt-1 text-xs text-gray-500">{item.authorName} · {when(item.createdAt)}</p></li>)}
        {!file.notes.length && <li className="text-sm text-gray-400">Aucune note.</li>}
      </ul>
    </div>

    <div className="space-y-3 rounded-2xl border border-gray-100 p-4">
      <h5 className="font-bold text-haven-ink">Données personnelles (RGPD)</h5>
      <p className="text-xs text-gray-500">L’export répond à une demande d’accès du membre. L’effacement anonymise le compte et supprime sa connexion ; les réservations et paiements sont conservés pour les obligations comptables. Il est refusé tant qu’un séjour est à venir ou qu’une annonce est en ligne.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void exportData()} className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-haven-ink">Exporter ses données (JSON)</button>
        <button type="button" onClick={() => void erase()} className="min-h-11 rounded-xl border border-red-100 px-3 text-sm font-semibold text-haven-red">Effacer et anonymiser le compte</button>
      </div>
    </div>

    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="font-bold text-haven-ink">Chronologie</h5>
        <select value={filter} onChange={event => setFilter(event.target.value)} className="h-11 rounded-xl border border-gray-200 px-3 text-sm" aria-label="Filtrer la chronologie">
          <option value="ALL">Tout</option>
          {Object.entries(KIND_LABEL).filter(([key]) => key !== 'NOTE').map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      <ol className="space-y-2 border-l-2 border-gray-100 pl-4">
        {events.map((event, index) => <li key={`${event.at}-${index}`} className="text-sm">
          <p className="text-xs text-gray-400">{when(event.at)} · {KIND_LABEL[event.kind]}</p>
          <p className="font-medium text-haven-ink">{event.label}</p>
          {event.detail && <p className="break-words text-xs text-gray-500">{event.detail}</p>}
        </li>)}
        {!events.length && <li className="text-sm text-gray-400">Rien à afficher.</li>}
      </ol>
    </div>
  </section>;
}


/** Owner status and DAC7 tax details, for Haven only (payouts wait while they are incomplete). */
function AdminTaxProfile({ userId }: { userId: string }) {
  const [data, setData] = useState<{ profile: Record<string, any> | null; complete: boolean } | null>(null);
  useEffect(() => {
    void authenticatedFetch(`/api/admin/owners/${encodeURIComponent(userId)}/tax-profile`).then(response => response.ok ? response.json() : null).then(setData).catch(() => setData(null));
  }, [userId]);
  if (!data?.profile) return data ? <p className="text-sm text-gray-500">Statut et informations fiscales (DAC7) : non renseignés.</p> : null;
  const profile = data.profile;
  return <div className="rounded-2xl border border-gray-100 p-4 text-sm text-gray-700">
    <p className="font-semibold text-haven-ink">Statut et informations fiscales (DAC7) · {data.complete ? 'complets' : 'incomplets'}</p>
    <p className="mt-1">{profile.status === 'PROFESSIONNEL' ? `Professionnel (${profile.legalForm === 'SOCIETE' ? 'société' : 'entreprise individuelle'}) · SIRET ${profile.siret}` : 'Particulier'}{profile.companyName ? ` · ${profile.companyName}` : ''}</p>
    {profile.nif && <p>NIF {profile.nif} ({profile.nifCountry}) · né(e) le {profile.birthDate}</p>}
    <p>{[profile.address?.street, profile.address?.postalCode, profile.address?.city, profile.address?.country].filter(Boolean).join(', ')}</p>
  </div>;
}
