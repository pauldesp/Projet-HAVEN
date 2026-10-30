import { useLanguage } from '../contexts/LanguageContext';
import { useEffect, useState } from 'react';
import { Home, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authenticatedFetch } from '../services/serverApi';
import { prepareVerificationDocument } from '../services/verificationDocument';
import type { Residence } from '../services/residence';

export function AccountResidence() {
  const { tr } = useLanguage();
  const { currentUser, refreshUser } = useAuth();
  const [residence, setResidence] = useState<Residence>({ address: '', postalCode: '', city: '', country: 'France' });
  const [proof, setProof] = useState<string>(); const [filename, setFilename] = useState('');
  const [loaded, setLoaded] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    if (currentUser) void authenticatedFetch(`/api/users/${currentUser.id}/residence`).then(async response => {
      if (!response.ok) throw new Error(tr("Impossible de charger votre domicile. Rechargez la page."));
      const data = await response.json(); if (active) { setResidence({ address: data.address || '', postalCode: data.postalCode || '', city: data.city || '', country: data.country || 'France' }); setLoaded(true); }
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [currentUser?.id]);
  const save = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await authenticatedFetch('/api/users/me/residence', { method: 'PUT', body: JSON.stringify({ residence, ...(proof ? { documentDataUrl: proof } : {}) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || tr("Enregistrement impossible."));
      setProof(undefined); setFilename(''); await refreshUser(); setMessage(tr("Domicile enregistré. Retrouvez la transmission du dossier dans la vérification du compte."));
    } catch (error) { setMessage(error instanceof Error ? error.message : tr("Enregistrement impossible.")); } finally { setBusy(false); }
  };
  return <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-soft md:p-8">
    <h2 className="flex items-center gap-3 font-heading text-xl font-bold text-haven-navy"><Home size={22} />{tr("Mon domicile")}</h2>
    <p className="mt-3 text-sm text-gray-500">{tr("Votre adresse de résidence et son justificatif sont réservés à vous et à l’administration Haven.")}</p>
    <form onSubmit={event => { event.preventDefault(); void save(); }} className="mt-6 space-y-5"><fieldset disabled={!loaded || busy} className="grid gap-4 sm:grid-cols-2 disabled:opacity-50">
      {([['address', tr("Adresse complète"), 'street-address'], ['postalCode', tr("Code postal"), 'postal-code'], ['city', tr("Commune"), 'address-level2'], ['country', tr("Pays"), 'country-name']] as const).map(([key, label, autoComplete]) => <label key={key} className={`text-sm font-bold ${key === 'address' ? 'sm:col-span-2' : ''}`}>{label}<input required value={residence[key]} maxLength={key === 'address' ? 200 : key === 'postalCode' ? 20 : 100} autoComplete={autoComplete} onChange={event => setResidence(current => ({ ...current, [key]: event.target.value }))} className="mt-2 block w-full rounded-xl border border-gray-200 p-3 font-normal" /></label>)}
    </fieldset>
    <div className="rounded-2xl bg-gray-50 p-5"><h3 className="flex items-center gap-2 font-bold"><Upload size={18} />{tr("Justificatif de domicile")}</h3><p className="mt-2 text-sm text-gray-500">{tr("Joignez un document lisible à votre nom mentionnant cette adresse : facture d’énergie, d’eau ou d’internet, quittance de loyer, par exemple. Photos jusqu’à 10 Mo avant optimisation ; PDF jusqu’à 600 Ko.")}</p><input aria-label={tr("Ajouter un justificatif de domicile")} disabled={busy || !loaded} type="file" accept="image/jpeg,image/png,application/pdf" className="mt-4 block w-full text-sm" onChange={event => { const file = event.target.files?.[0]; if (!file) return; setBusy(true); setMessage(''); void prepareVerificationDocument(file).then(data => { setProof(data); setFilename(file.name); }).catch(error => setMessage(error.message)).finally(() => setBusy(false)); event.target.value = ''; }} />{filename && <p className="mt-2 text-sm">{tr("Prêt à enregistrer :")} {filename}</p>}{currentUser?.documents?.proofOfAddress && !proof && <p className="mt-2 text-sm text-gray-600">{currentUser.residenceVerified ? tr("Domicile vérifié par Haven") : tr("Justificatif transmis, à examiner par Haven")}</p>}</div>
    <p className="text-xs text-gray-500">{tr("Si vous changez d’adresse, joignez un nouveau justificatif. La modification du domicile ou du document entraîne un nouveau contrôle du dossier.")}</p>
    <button disabled={!loaded || busy} className="rounded-xl bg-haven-navy px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? tr("Préparation…") : tr("Enregistrer mon domicile")}</button></form>
    {message && <p role="status" className="mt-4 text-sm">{tr(message)}</p>}
  </section>;
}
