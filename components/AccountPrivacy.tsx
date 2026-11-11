import { useState } from 'react';
import { Download, Loader2, Trash2, UserX } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { auth } from '../firebase';
import { authenticatedFetch } from '../services/serverApi';

/** The member's own GDPR rights: download all their data, or delete their account. */
export function AccountPrivacy() {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');

  const download = async () => {
    setExporting(true);
    try {
      const response = await authenticatedFetch('/api/me/export');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Téléchargement impossible.');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      link.download = `mes-donnees-haven-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Téléchargement impossible.'); }
    finally { setExporting(false); }
  };

  const erase = async () => {
    if (confirmText.trim().toUpperCase() !== 'SUPPRIMER' || deleting) return;
    setDeleting(true); setError('');
    try {
      const response = await authenticatedFetch('/api/me/erase', { method: 'POST', body: JSON.stringify({ confirm: 'SUPPRIMER' }) });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        // A fresh sign-in is required: sign out and come back here afterwards.
        toast.info(data.error || 'Reconnectez-vous puis recommencez la suppression.');
        await signOut(auth).catch(() => undefined);
        navigate('/login?redirect=/account');
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Suppression impossible.');
      await signOut(auth).catch(() => undefined);
      toast.success('Votre compte a été supprimé. Merci d’avoir utilisé Haven.');
      navigate('/');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Suppression impossible.'); }
    finally { setDeleting(false); }
  };

  return <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-soft md:p-8">
    <h2 className="flex items-center gap-3 font-heading text-xl font-bold text-haven-navy"><UserX size={22} aria-hidden="true" />Mes données personnelles</h2>
    <p className="mt-3 text-sm text-gray-500">Vous pouvez à tout moment télécharger l’ensemble des données que Haven conserve à votre sujet, ou supprimer votre compte.</p>
    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
      <button type="button" disabled={exporting} onClick={() => void download()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 text-sm font-bold text-haven-navy disabled:opacity-50">
        {exporting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}Télécharger mes données
      </button>
      <button type="button" onClick={() => { setConfirmOpen(true); setConfirmText(''); setError(''); }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-100 px-5 text-sm font-bold text-haven-red hover:bg-red-50">
        <Trash2 size={16} aria-hidden="true" />Supprimer mon compte
      </button>
    </div>

    {confirmOpen && <div className="fixed inset-0 z-[120] flex items-end justify-center bg-haven-navy/60 p-0 sm:items-center sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="erase-title" className="haven-dialog-panel w-full max-w-lg space-y-4 rounded-t-3xl bg-white p-6 sm:rounded-3xl">
        <h3 id="erase-title" className="text-xl font-bold text-haven-navy">Supprimer définitivement mon compte</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-gray-600">
          <li>Votre connexion, votre profil, vos justificatifs d’identité et de domicile sont supprimés.</li>
          <li>Vos réservations, paiements et états des lieux passés sont conservés sans votre nom, car la loi impose de garder les pièces comptables.</li>
          <li>La suppression est impossible tant qu’un séjour est à venir ou en cours, ou qu’une de vos annonces est en ligne.</li>
          <li>Cette action est irréversible.</li>
        </ul>
        <label className="block text-sm font-semibold text-haven-navy">Pour confirmer, tapez SUPPRIMER
          <input value={confirmText} onChange={event => setConfirmText(event.target.value)} autoComplete="off" autoCapitalize="characters" className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 font-normal" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="haven-dialog-footer flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={deleting} onClick={() => setConfirmOpen(false)} className="min-h-11 rounded-xl px-4 font-semibold text-gray-600 hover:bg-gray-100">Annuler</button>
          <button type="button" disabled={deleting || confirmText.trim().toUpperCase() !== 'SUPPRIMER'} onClick={() => void erase()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-haven-red px-4 font-bold text-white disabled:opacity-40">
            {deleting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}Supprimer mon compte
          </button>
        </div>
      </section>
    </div>}
  </section>;
}
