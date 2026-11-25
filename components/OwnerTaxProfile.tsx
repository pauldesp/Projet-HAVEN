import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { authenticatedFetch } from '../services/serverApi';
import { BirthDateInput } from './BirthDateInput';

type Form = {
  status: '' | 'PARTICULIER' | 'PROFESSIONNEL'; legalForm: '' | 'INDIVIDUEL' | 'SOCIETE';
  siret: string; companyName: string; nif: string; nifCountry: string; birthDate: string;
  address: { street: string; postalCode: string; city: string; country: string };
};
const empty: Form = { status: '', legalForm: '', siret: '', companyName: '', nif: '', nifCountry: 'FR', birthDate: '', address: { street: '', postalCode: '', city: '', country: 'FR' } };

/**
 * Owner status (private or professional host, shown on listings) and the tax details Haven must collect before
 * any payout (DAC7). Stored privately by the server, like identity documents; the tax number comes back masked.
 */
export function OwnerTaxProfile() {
  const [form, setForm] = useState<Form>(empty);
  const [complete, setComplete] = useState<boolean | null>(null);
  // Shown only once money has been collected for this owner (or details were already given).
  const [visible, setVisible] = useState(false);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void authenticatedFetch('/api/owners/me/tax-profile').then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Informations indisponibles.');
      setComplete(Boolean(data.complete));
      setVisible(Boolean(data.requested || data.profile));
      setDeadlineAt(data.deadlineAt || null);
      if (!data.profile && data.prefill) setForm(previous => ({ ...previous, birthDate: data.prefill.birthDate || '', address: data.prefill.address ? { ...empty.address, ...data.prefill.address } : previous.address }));
      if (data.profile) setForm({ ...empty, ...data.profile, legalForm: data.profile.legalForm || '', siret: data.profile.siret || '', companyName: data.profile.companyName || '', nif: data.profile.nif || '', nifCountry: data.profile.nifCountry || 'FR', birthDate: data.profile.birthDate || '', address: { ...empty.address, ...data.profile.address } });
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'Informations indisponibles.'));
  }, []);
  const set = (patch: Partial<Form>) => setForm(previous => ({ ...previous, ...patch }));
  const setAddress = (patch: Partial<Form['address']>) => setForm(previous => ({ ...previous, address: { ...previous.address, ...patch } }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const response = await authenticatedFetch('/api/owners/me/tax-profile', { method: 'PUT', body: JSON.stringify(form) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Enregistrement impossible.');
      setComplete(true); setDeadlineAt(null); set({ nif: data.profile?.nif || form.nif });
      toast.success('Statut et informations fiscales enregistrés.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  };
  const field = 'mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 text-base text-haven-ink focus:border-haven-navy focus:outline-none';
  const company = form.status === 'PROFESSIONNEL' && form.legalForm === 'SOCIETE';
  const choice = (active: boolean) => `min-h-11 rounded-full border px-4 text-sm font-semibold ${active ? 'border-haven-navy bg-haven-navy text-white' : 'border-gray-300 text-haven-ink hover:bg-gray-100'}`;

  if (!visible) return null;
  return <section id="statut-fiscal" className="space-y-4 rounded-3xl border border-gray-100 bg-white p-5 sm:p-6">
    <div>
      <h2 className="font-heading text-2xl font-normal text-haven-ink">Statut et informations fiscales</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">Votre statut apparaît sur vos annonces (« Hôte particulier » ou « Hôte professionnel »). Comme toutes les plateformes de location, Haven doit connaître votre numéro fiscal pour déclarer les revenus perçus à l’administration (directive européenne DAC7). Ces informations restent confidentielles, visibles par vous et par Haven seulement.</p>
    </div>
    {complete === false && deadlineAt && <p role="status" className="rounded-xl bg-haven-sand p-3 text-sm text-haven-ink">{Date.now() < Date.parse(deadlineAt) ? `À compléter avant le ${new Date(deadlineAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}. Vos versements continuent normalement d’ici là.` : 'Vos versements sont suspendus jusqu’à ce que ces informations soient complétées. Ils reprennent aussitôt après.'}</p>}
    {complete && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">Informations complètes.</p>}
    <form onSubmit={save} className="space-y-4 text-sm text-gray-700">
      <fieldset><legend className="font-semibold text-haven-ink">Vous louez en tant que</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" aria-pressed={form.status === 'PARTICULIER'} onClick={() => set({ status: 'PARTICULIER', legalForm: '' })} className={choice(form.status === 'PARTICULIER')}>Particulier</button>
          <button type="button" aria-pressed={form.status === 'PROFESSIONNEL'} onClick={() => set({ status: 'PROFESSIONNEL' })} className={choice(form.status === 'PROFESSIONNEL')}>Professionnel</button>
        </div>
      </fieldset>
      {form.status === 'PROFESSIONNEL' && <>
        <fieldset><legend className="font-semibold text-haven-ink">Forme</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" aria-pressed={form.legalForm === 'INDIVIDUEL'} onClick={() => set({ legalForm: 'INDIVIDUEL' })} className={choice(form.legalForm === 'INDIVIDUEL')}>Entreprise individuelle</button>
            <button type="button" aria-pressed={form.legalForm === 'SOCIETE'} onClick={() => set({ legalForm: 'SOCIETE' })} className={choice(form.legalForm === 'SOCIETE')}>Société</button>
          </div>
        </fieldset>
        <label className="block">Numéro SIRET (14 chiffres)<input inputMode="numeric" value={form.siret} onChange={event => set({ siret: event.target.value })} maxLength={20} className={field} /></label>
        {company && <label className="block">Dénomination de la société<input value={form.companyName} onChange={event => set({ companyName: event.target.value })} maxLength={200} className={field} /></label>}
      </>}
      {form.status && !company && <>
        <label className="block">Numéro fiscal (NIF, 13 chiffres, sur votre avis d’impôt)<input inputMode="numeric" value={form.nif} onChange={event => set({ nif: event.target.value })} maxLength={30} autoComplete="off" className={field} /></label>
        <div className="block">Date de naissance<BirthDateInput value={form.birthDate} onChange={birthDate => set({ birthDate })} /></div>
      </>}
      {form.status && <fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-1 font-semibold text-haven-ink">{company ? 'Adresse du siège' : 'Adresse de résidence'}</legend>
        <label className="block sm:col-span-2">Rue<input value={form.address.street} onChange={event => setAddress({ street: event.target.value })} autoComplete="street-address" maxLength={200} className={field} /></label>
        <label className="block">Code postal<input value={form.address.postalCode} onChange={event => setAddress({ postalCode: event.target.value })} autoComplete="postal-code" maxLength={20} className={field} /></label>
        <label className="block">Ville<input value={form.address.city} onChange={event => setAddress({ city: event.target.value })} autoComplete="address-level2" maxLength={100} className={field} /></label>
      </fieldset>}
      {error && <p role="alert" className="text-haven-red">{error}</p>}
      <button type="submit" disabled={!form.status || saving} className="min-h-11 rounded-full bg-haven-navy px-5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
    </form>
  </section>;
}
