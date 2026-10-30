import { useLanguage } from '../contexts/LanguageContext';
import { AccountPersonalDetails } from '../components/AccountPersonalDetails';
import { AccountResidence } from '../components/AccountResidence';
import { AccountDocuments } from '../components/AccountDocuments';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AccountStatusOverlay } from '../components/AccountStatusOverlay';
import { isAccountVerificationComplete, isVerificationPending } from '../services/profileVerification';
import { hasVerificationException } from '../services/verificationException';
import { requestPasswordResetEmail } from '../services/authEmailApi';
import { userFacingErrorMessage } from '../services/errorHandling';

export function AccountPage() {
  const { tr } = useLanguage();
  const { currentUser } = useAuth();
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [message, setMessage] = useState('');
  if (!currentUser) return null;
  const exception = hasVerificationException(currentUser);
  const verified = isAccountVerificationComplete(currentUser);
  const pending = isVerificationPending(currentUser);
  const status = exception ? tr("Validation exceptionnelle de test") : verified ? tr("Compte validé") : currentUser.status === 'REJECTED' ? tr("Dossier à corriger") : pending ? tr("Dossier en cours de vérification") : tr("Dossier à compléter");
  const resetPassword = async () => {
    setSending(true); setMessage('');
    try { await requestPasswordResetEmail(currentUser.email); setResetSent(true); setMessage(tr("Si votre compte permet la connexion par mot de passe, vous recevrez un lien pour le modifier.")); }
    catch (error) { setMessage(userFacingErrorMessage(error)); }
    finally { setSending(false); }
  };
  return <div className="min-h-screen bg-haven-cream px-4 py-10 md:py-14"><div className="mx-auto max-w-4xl space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-widest text-haven-red">{tr("Espace privé")}</p><h1 className="mt-3 font-heading text-3xl font-bold text-haven-navy">{tr("Mon compte")}</h1><p className="mt-3 text-gray-500">{tr("Vos informations personnelles, votre dossier de vérification et la sécurité de votre accès.")}</p></header>
    <AccountPersonalDetails onManage={() => setVerificationOpen(true)} />
    <AccountResidence />
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-soft md:p-8">
      <h2 className="flex items-center gap-3 font-heading text-xl font-bold text-haven-navy"><ShieldCheck size={22} />{tr("Vérification du compte")}</h2>
      <p className={`mt-4 inline-flex rounded-full px-4 py-2 text-sm font-bold ${verified && !exception ? 'bg-green-50 text-green-700' : pending ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'}`}>{status}</p>
      {currentUser.rejectionReason && currentUser.status === 'REJECTED' && <p className="mt-3 text-sm text-gray-600">{currentUser.rejectionReason}</p>}
      <p className="mt-4 text-sm text-gray-500">{tr("Retrouvez ici vos coordonnées et les justificatifs transmis à Haven. Ils ne figurent pas sur votre profil public.")}</p>
    </section>
    <AccountDocuments onManageIdentity={() => setVerificationOpen(true)} />
    <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-soft md:p-8">
      <h2 className="flex items-center gap-3 font-heading text-xl font-bold text-haven-navy"><LockKeyhole size={22} />{tr("Sécurité")}</h2>
      <p className="mt-3 text-sm text-gray-500">{tr("Recevez un lien sécurisé par e-mail pour modifier votre mot de passe.")}</p>
      <button type="button" disabled={sending || resetSent} onClick={() => void resetPassword()} className="mt-4 rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-haven-navy disabled:opacity-50">{sending ? tr("Envoi…") : resetSent ? tr("Demande envoyée") : tr("Modifier mon mot de passe")}</button>
      {message && <p role="status" className="mt-3 text-sm text-gray-600">{tr(message)}</p>}
    </section>
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-haven-navy p-6 text-white"><div><h2 className="font-bold">{tr("Votre présentation aux autres membres")}</h2><p className="mt-1 text-sm text-white/75">{tr("Prénom, âge, activité et centres d’intérêt.")}</p></div><Link to={`/profile/${currentUser.id}`} className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-haven-navy">{tr("Voir mon profil public")}</Link></div>
    <AccountStatusOverlay isOpen={verificationOpen} onClose={() => setVerificationOpen(false)} />
  </div></div>;
}
