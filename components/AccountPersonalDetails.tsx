import { useLanguage } from '../contexts/LanguageContext';
import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { BirthDateInput } from './BirthDateInput';
import { normalizePhoneForVerification } from '../services/phoneVerification';
import { userFacingErrorMessage } from '../services/errorHandling';
import { AccountEmailChange } from './AccountEmailChange';

export function AccountPersonalDetails({ onManage }: { onManage: () => void }) {
  const { tr, locale } = useLanguage();
  const { currentUser, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(''); const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState(''); const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { if (currentUser && !editing) { setFirstName(currentUser.firstName); setLastName(currentUser.lastName); setBirthDate(currentUser.birthDate || ''); setPhone(currentUser.phone || ''); } }, [currentUser, editing]);
  if (!currentUser) return null;
  const save = async () => {
    setBusy(true); setMessage('');
    try { await apiService.users.updatePersonalDetails(currentUser.id, { firstName, lastName, birthDate, phone: normalizePhoneForVerification(phone) }); await refreshUser(); setEditing(false); setMessage(tr("Coordonnées enregistrées. Si elles ont changé, transmettez votre dossier pour un nouveau contrôle.")); }
    catch (error) { setMessage(userFacingErrorMessage(error)); } finally { setBusy(false); }
  };
  const inputClass = 'mt-2 block w-full rounded-xl border border-gray-200 p-3 font-normal';
  return <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-soft md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="flex items-center gap-3 font-heading text-xl font-bold text-haven-navy"><UserRound size={22} />{tr("Informations personnelles")}</h2><button type="button" disabled={busy} onClick={() => { setEditing(!editing); setMessage(''); }} className="rounded-xl border px-4 py-2 text-sm font-bold text-haven-navy">{editing ? tr("Annuler") : tr("Modifier")}</button></div>
    {editing ? <form onSubmit={event => { event.preventDefault(); void save(); }} className="mt-6 space-y-5"><div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-bold">{tr("Prénom")}<input required maxLength={99} value={firstName} onChange={event => setFirstName(event.target.value)} autoComplete="given-name" className={inputClass} /></label>
      <label className="text-sm font-bold">{tr("Nom")}<input required maxLength={99} value={lastName} onChange={event => setLastName(event.target.value)} autoComplete="family-name" className={inputClass} /></label>
      <div className="text-sm font-bold">{tr("Date de naissance")}<BirthDateInput value={birthDate} onChange={setBirthDate} /></div>
      <label className="text-sm font-bold">{tr("Téléphone")}<input required type="tel" value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" className={inputClass} /></label>
    </div><p className="text-sm text-gray-500">{tr("Une modification des coordonnées entraîne un nouveau contrôle du dossier. L’identité et le téléphone modifiés perdent leur validation précédente.")}</p><button disabled={busy} className="rounded-xl bg-haven-navy px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? tr("Enregistrement…") : tr("Enregistrer les modifications")}</button></form> : <dl className="mt-6 grid gap-5 sm:grid-cols-2"><div><dt className="text-sm text-gray-500">{tr("Prénom et nom")}</dt><dd className="mt-1 font-bold">{currentUser.firstName} {currentUser.lastName}</dd></div><div><dt className="text-sm text-gray-500">{tr("Date de naissance")}</dt><dd className="mt-1 font-bold">{currentUser.birthDate ? new Date(`${currentUser.birthDate}T12:00:00`).toLocaleDateString(locale) : tr("Non renseignée")}</dd></div><div><dt className="text-sm text-gray-500">{tr("Téléphone")}</dt><dd className="mt-1 font-bold">{currentUser.phone || tr("Non renseigné")}</dd></div></dl>}
    <AccountEmailChange />
    {message && <p role="status" className="mt-4 text-sm">{tr(message)}</p>}
    <button type="button" onClick={onManage} className="mt-5 text-sm font-bold text-haven-navy underline underline-offset-4">{tr("Vérifier et transmettre mon dossier")}</button>
  </section>;
}
