import { useLanguage } from '../contexts/LanguageContext';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authenticatedFetch } from '../services/serverApi';
import { auth } from '../firebase';

export function AccountEmailChange() {
  const { tr } = useLanguage();
  const { currentUser, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false); const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false); const [message, setMessage] = useState('');
  const sync = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload(); await auth.currentUser.getIdToken(true);
    if (auth.currentUser.email?.toLowerCase() !== currentUser?.email.toLowerCase()) {
      const response = await authenticatedFetch('/api/users/me/confirm-email', { method: 'POST', body: '{}' });
      if (!response.ok) throw new Error(tr("Reconnectez-vous avec la nouvelle adresse pour terminer la mise à jour."));
      await refreshUser(); setSent(false); setEditing(false); setMessage(tr("Adresse e-mail mise à jour."));
    }
  };
  useEffect(() => {
    void sync().catch(() => {});
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void sync().catch(() => {}); }, 15_000);
    return () => clearInterval(timer);
  }, [currentUser?.id, currentUser?.email]);
  const send = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await authenticatedFetch('/api/users/me/request-email-change', { method: 'POST', body: JSON.stringify({ email }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || tr("Envoi impossible."));
      setSent(true); setMessage(tr("Un lien a été envoyé à la nouvelle adresse. Confirmez-le pour appliquer le changement."));
    } catch (error) { setMessage(error instanceof Error ? error.message : tr("Envoi impossible.")); } finally { setBusy(false); }
  };
  return <div className="mt-6 border-t border-gray-100 pt-5"><p className="text-sm text-gray-500">{tr("Adresse e-mail")}</p><p className="mt-1 break-words font-bold">{currentUser?.email}</p><p className="mt-1 text-sm text-gray-500">{currentUser?.emailVerified ? tr("Confirmée") : tr("À confirmer")}</p>
    <button type="button" disabled={busy} onClick={() => setEditing(!editing)} className="mt-3 text-sm font-bold text-haven-navy underline underline-offset-4">{tr("Modifier mon e-mail")}</button>
    {editing && <form onSubmit={event => { event.preventDefault(); void send(); }} className="mt-4 space-y-3"><label className="block text-sm font-bold">{tr("Nouvelle adresse e-mail")}<input required type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} className="mt-2 block w-full rounded-xl border p-3 font-normal" /></label><button disabled={busy || sent} className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-50">{busy ? tr("Envoi…") : tr("Recevoir le lien de confirmation")}</button></form>}
    {sent && <button type="button" onClick={() => void sync().catch(error => setMessage(error.message))} className="mt-3 block text-sm font-bold underline">{tr("J’ai confirmé la nouvelle adresse")}</button>}
    {message && <p role="status" className="mt-3 text-sm">{tr(message)}</p>}
  </div>;
}
