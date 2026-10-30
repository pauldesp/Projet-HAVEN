import { translateActivity } from '../services/uiTranslations';
import { useLanguage } from '../contexts/LanguageContext';
import { useState } from 'react';
import type { User } from '../types';
import { ACTIVITIES, INTERESTS, profileActivity, profileAge, profileInterests, type Activity } from '../services/publicProfile';
import { authenticatedFetch } from '../services/serverApi';

export function TenantCommunityProfile({ user, own, onSaved }: { user: User; own: boolean; onSaved: (updates: Partial<User>) => Promise<void> }) {
  const { tr, language } = useLanguage();
  const [activity, setActivity] = useState<Activity | ''>(user.activity || (user.school ? 'STUDENT' : user.job ? 'EMPLOYED' : ''));
  const [school, setSchool] = useState(user.school || '');
  const [job, setJob] = useState(user.job || '');
  const [interests, setInterests] = useState(profileInterests(user.interests));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const age = own ? profileAge(user.birthDate) : user.age;
  const save = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await authenticatedFetch('/api/users/me/community-profile', { method: 'PATCH', body: JSON.stringify({ activity, school, job, interests }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || tr("Enregistrement impossible."));
      await onSaved(data); setEditing(false); setMessage(tr("Profil enregistré."));
    } catch (error) { setMessage(error instanceof Error ? error.message : tr("Enregistrement impossible.")); }
    finally { setBusy(false); }
  };
  return <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-soft md:p-10">
    <p className="text-xs font-bold uppercase tracking-widest text-haven-red">{own ? tr("Mon profil public") : tr("Profil locataire")}</p>
    <h1 className="mt-3 font-heading text-3xl font-bold text-haven-navy">{user.firstName}{age !== undefined ? `, ${age} ${language === 'en' ? 'years old' : 'ans'}` : ''}</h1>
    <p className="mt-3 text-gray-600">{translateActivity(user.activityLabel || profileActivity(user) || tr("Activité non renseignée"), language)}</p>
    <h2 className="mt-7 font-bold text-haven-navy">{tr("Centres d’intérêt")}</h2>
    <div className="mt-3 flex flex-wrap gap-2">{profileInterests(user.interests).map(interest => <span key={interest} className="rounded-full bg-haven-cream px-4 py-2 text-sm text-haven-navy">{tr(interest)}</span>)}</div>
    {!profileInterests(user.interests).length && <p className="mt-2 text-sm text-gray-500">{tr("Pas encore renseignés.")}</p>}
    {own && <>
      <p className="mt-6 text-sm text-gray-500">{tr("Les propriétaires et les colocataires voient votre prénom, votre âge, votre activité et vos centres d’intérêt. Votre date de naissance et vos coordonnées ne figurent pas sur cette fiche.")}</p>
      <button type="button" disabled={busy} onClick={() => setEditing(!editing)} className="mt-5 rounded-xl border border-gray-200 px-5 py-3 font-bold text-haven-navy">{editing ? tr("Fermer la modification") : tr("Modifier mon profil")}</button>
      {editing && <div className="mt-6 space-y-5 border-t border-gray-100 pt-6">
        <label className="block text-sm font-bold text-haven-navy">{tr("Mon activité")} <select value={activity} onChange={event => setActivity(event.target.value as Activity)} className="mt-2 block w-full rounded-xl border p-3 font-normal"><option value="">{tr("Choisir une activité")}</option>{Object.entries(ACTIVITIES).map(([key, label]) => <option key={key} value={key}>{tr(label)}</option>)}</select>
        </label>
        {['STUDENT', 'TRAINING'].includes(activity) && <label className="block text-sm font-bold text-haven-navy">{activity === 'STUDENT' ? tr("Mon école ou université") : tr("Mon organisme de formation")}<input value={school} maxLength={100} onChange={event => setSchool(event.target.value)} className="mt-2 block w-full rounded-xl border p-3 font-normal" /></label>}
        {['EMPLOYED', 'SELF_EMPLOYED'].includes(activity) && <label className="block text-sm font-bold text-haven-navy">{tr("Mon domaine d’activité")}<input value={job} maxLength={100} placeholder={tr("Ex. Santé, enseignement, informatique…")} onChange={event => setJob(event.target.value)} className="mt-2 block w-full rounded-xl border p-3 font-normal" /></label>}
        <fieldset><legend className="text-sm font-bold text-haven-navy">{tr("Mes centres d’intérêt ·")} {interests.length}/8</legend><div className="mt-3 flex flex-wrap gap-2">{INTERESTS.map(interest => <button type="button" key={interest} aria-pressed={interests.includes(interest)} disabled={!interests.includes(interest) && interests.length >= 8} onClick={() => setInterests(current => current.includes(interest) ? current.filter(item => item !== interest) : [...current, interest])} className={`rounded-full border px-4 py-2 text-sm disabled:opacity-40 ${interests.includes(interest) ? 'border-haven-navy bg-haven-navy text-white' : 'border-gray-200 text-gray-600'}`}>{tr(interest)}</button>)}</div></fieldset>
        <button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl bg-haven-navy px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? tr("Enregistrement…") : tr("Enregistrer")}</button>
      </div>}
    </>}
    {message && <p role="status" className="mt-4 text-sm text-haven-navy">{tr(message)}</p>}
  </section>;
}
