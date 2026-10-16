
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, Clock, XCircle, ShieldCheck, Upload, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';
import { apiService } from '../services/api';
import { UserRole, LegalDocument } from '../types';
import ReactMarkdown from 'react-markdown';
import { selectAccountTerms } from '../services/accountTerms';
import { toast } from 'sonner';
import { reload, sendEmailVerification } from 'firebase/auth';
import { auth } from '../firebase';
import { prepareVerificationDocument } from '../services/verificationDocument';
import { hasCompleteVerificationDetails, hasRequiredPhoneNumber, isVerificationPending, isAccountVerificationComplete, isValidPastBirthDate, isVerificationReadyToSubmit } from '../services/profileVerification';
import { BirthDateInput } from './BirthDateInput';
import { EMAIL_LIMIT_BACKOFF_MS, EMAIL_RESEND_DELAY_MS, emailRetrySeconds, finishAccountEmailVerification, requestAccountEmailVerification } from '../services/accountEmailVerification';
import { isValidPhoneForVerification, normalizePhoneForVerification } from '../services/phoneVerification';

interface AccountStatusOverlayProps {
  isOpen?: boolean;
  onClose?: () => void;
  forced?: boolean; // If true, it acts like the old blocking overlay
}

export const AccountStatusOverlay: React.FC<AccountStatusOverlayProps> = ({ 
  isOpen: propIsOpen, 
  onClose,
  forced = false 
}) => {
  const { currentUser, accountRole, refreshUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [firstName, setFirstName] = useState(currentUser?.firstName || '');
  const [lastName, setLastName] = useState(currentUser?.lastName || '');
  const [birthDate, setBirthDate] = useState(currentUser?.birthDate || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [emailRetryAt, setEmailRetryAt] = useState(0);
  const [emailClock, setEmailClock] = useState(Date.now());
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [terms, setTerms] = useState<LegalDocument | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState('');

  useEffect(() => {
    if (!currentUser) return;
    setFirstName(currentUser.firstName || '');
    setLastName(currentUser.lastName || '');
    setBirthDate(currentUser.birthDate || '');
    setPhone(currentUser.phone || '');
    setEmailLinkSent(false);
    setEmailError('');
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) return;
    try { setEmailRetryAt(Number(localStorage.getItem(`haven-email-retry:${currentUser.id}`)) || 0); } catch { setEmailRetryAt(0); }
    setEmailClock(Date.now());
  }, [currentUser?.id, propIsOpen, forced]);
  useEffect(() => {
    if (emailRetryAt <= Date.now()) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setEmailClock(now);
      if (now >= emailRetryAt) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [emailRetryAt]);

  const deferEmailRequest = (delay: number) => {
    const retryAt = Date.now() + delay;
    setEmailRetryAt(retryAt);
    setEmailClock(Date.now());
    try { if (currentUser) localStorage.setItem(`haven-email-retry:${currentUser.id}`, String(retryAt)); } catch { /* The in-memory delay still applies. */ }
  };
  const emailWaitSeconds = emailRetrySeconds(emailRetryAt, emailClock);

  const loadTerms = async () => {
    setTermsError('');
    setTermsAccepted(false);
    try {
      const document = selectAccountTerms(await apiService.settings.getAllLegalDocuments());
      if (!document) throw new Error('Les conditions générales sont momentanément indisponibles.');
      setTerms(document);
    } catch (error) {
      setTerms(null);
      setTermsError(error instanceof Error ? error.message : 'Impossible de charger les conditions générales.');
    }
  };
  useEffect(() => {
    if (currentUser && currentUser.legalAccepted !== true && (propIsOpen || forced)) void loadTerms();
  }, [currentUser?.id, currentUser?.legalAccepted, propIsOpen, forced]);

  useEffect(() => {
    if (!currentUser || currentUser.emailVerified || (!propIsOpen && !forced)) return;
    let cancelled = false;
    let running = false;
    let retryAfter = 0;
    const profile = { id: currentUser.id, email: currentUser.email };
    const synchronizeEmail = async () => {
      if (cancelled || running || document.visibilityState === 'hidden' || Date.now() < retryAfter) return;
      const firebaseUser = auth.currentUser;
      if (!firebaseUser || firebaseUser.uid !== profile.id) return;
      running = true;
      try {
        const confirmed = await finishAccountEmailVerification(firebaseUser, profile, {
          reload: () => reload(firebaseUser),
          confirm: async () => {
            if (cancelled || auth.currentUser?.uid !== profile.id) return;
            await firebaseUser.getIdToken(true);
            await apiService.users.confirmEmail();
            if (!cancelled) await refreshUser();
          }
        });
        if (confirmed && !cancelled) {
          setEmailError('');
          setEmailLinkSent(false);
        }
      } catch (error) {
        // Quiet background synchronization must not interrupt the form or
        // trigger another e-mail. Back off if Firebase rate-limits reads.
        retryAfter = Date.now() + 60_000;
        console.debug('Confirmation automatique de l’e-mail différée', (error as { code?: string })?.code || 'network');
      } finally {
        running = false;
      }
    };
    void synchronizeEmail();
    window.addEventListener('focus', synchronizeEmail);
    window.addEventListener('online', synchronizeEmail);
    document.addEventListener('visibilitychange', synchronizeEmail);
    const timer = window.setInterval(synchronizeEmail, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', synchronizeEmail);
      window.removeEventListener('online', synchronizeEmail);
      document.removeEventListener('visibilitychange', synchronizeEmail);
    };
  }, [currentUser?.id, currentUser?.email, currentUser?.emailVerified, propIsOpen, forced]);

  // If not forced and not explicitly open, don't show anything
  if (!currentUser || currentUser.role === 'ADMIN') return null;
  
  const verificationRole = accountRole ?? currentUser.role;
  const requiredDocuments = [
    { type: 'idCard' as const, label: 'Pièce d’identité', detail: 'Carte nationale d’identité ou passeport en cours de validité.' },
  ];

  const isDocumentUploaded = (type: keyof NonNullable<typeof currentUser.documents>) =>
    Boolean(currentUser.documents?.[type]);
  const isComplete = requiredDocuments.every(document => isDocumentUploaded(document.type));
  const isVerifiedForCurrentRole = isAccountVerificationComplete(currentUser);
  const hasSavedDetails = hasCompleteVerificationDetails(currentUser);
  const isSubmittedForReview = isVerificationPending(currentUser);
  const savePersonalDetails = async () => {
    if (!currentUser || !firstName.trim() || !lastName.trim() || !birthDate || !phone.trim()) {
      setVerificationError('Renseignez votre prénom, votre nom, votre date de naissance et votre téléphone.');
      return false;
    }
    if (!isValidPastBirthDate(birthDate)) {
      setVerificationError('Saisissez une date de naissance valide et passée.');
      return false;
    }
    const normalizedPhone = normalizePhoneForVerification(phone);
    if (!isValidPhoneForVerification(normalizedPhone)) {
      setVerificationError('Saisissez un numéro avec son indicatif, par exemple +33 6 12 34 56 78.');
      return false;
    }
    await apiService.users.updatePersonalDetails(currentUser.id, { firstName: firstName.trim(), lastName: lastName.trim(), birthDate, phone: normalizedPhone });
    setPhone(normalizedPhone);
    setVerificationError('');
    return true;
  };
  const saveDetails = async () => {
    setIsSavingDetails(true);
    try {
      if (await savePersonalDetails()) {
        await refreshUser();
        toast.success('Informations enregistrées.');
      }
    } catch (error) {
      console.error('Saving verification details failed', error);
      setVerificationError(error instanceof Error ? error.message : 'Impossible d’enregistrer les informations.');
    } finally {
      setIsSavingDetails(false);
    }
  };
  const sendEmailLink = async () => {
    if (isVerifyingEmail || emailRetrySeconds(emailRetryAt) > 0) return;
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return setEmailError('Votre session a expiré. Reconnectez-vous puis réessayez.');
    setEmailError('');
    setIsVerifyingEmail(true);
    try {
      const result = await requestAccountEmailVerification(firebaseUser, currentUser, {
        reload: () => reload(firebaseUser),
        send: () => { auth.languageCode = 'fr'; return sendEmailVerification(firebaseUser); },
        confirm: async () => { await apiService.users.confirmEmail(); await refreshUser(); },
      });
      if (result === 'sent') {
        deferEmailRequest(EMAIL_RESEND_DELAY_MS);
        setEmailLinkSent(true);
        toast.success('Lien de validation envoyé par e-mail.');
      } else {
        setEmailLinkSent(false);
        toast.success('Adresse e-mail confirmée.');
      }
    } catch (error) {
      console.error('Email verification could not start', error);
      const code = (error as { code?: string })?.code;
      if (code === 'auth/too-many-requests') deferEmailRequest(EMAIL_LIMIT_BACKOFF_MS);
      setEmailError(code === 'auth/too-many-requests'
        ? 'Firebase limite temporairement les demandes. Utilisez un lien déjà reçu ou réessayez plus tard ; cette limite peut durer au-delà du délai affiché.'
        : code ? 'Impossible d’envoyer le lien pour le moment. Réessayez dans quelques instants.'
          : error instanceof Error ? error.message : 'Impossible d’envoyer l’e-mail de validation.');
    } finally {
      setIsVerifyingEmail(false);
    }
  };
  const confirmEmailLink = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return setEmailError('Votre session a expiré. Reconnectez-vous puis réessayez.');
    setEmailError('');
    setIsVerifyingEmail(true);
    try {
      const confirmed = await finishAccountEmailVerification(firebaseUser, currentUser, {
        reload: () => reload(firebaseUser),
        confirm: async () => { await apiService.users.confirmEmail(); await refreshUser(); },
      });
      if (!confirmed) {
        setEmailError('L’adresse n’est pas encore confirmée. Ouvrez le lien reçu par e-mail, puis réessayez ici.');
        return;
      }
      setEmailLinkSent(false);
      toast.success('Adresse e-mail confirmée.');
    } catch (error) {
      console.error('Email verification could not finish', error);
      setEmailError(error instanceof Error ? error.message : 'Impossible de confirmer l’adresse e-mail.');
    } finally {
      setIsVerifyingEmail(false);
    }
  };
  const submitDocumentsForReview = async () => {
    setIsSubmitting(true);
    try {
      if (!await savePersonalDetails()) return;
      if (!currentUser.legalAccepted && (!terms || !termsAccepted)) {
        setVerificationError('Acceptez les conditions générales avant de transmettre votre dossier.');
        return;
      }
      await apiService.users.submitVerification(verificationRole === UserRole.OWNER ? 'OWNER' : 'TENANT',
        terms ? { accepted: termsAccepted, version: terms.lastUpdated } : undefined);
      await refreshUser();
      toast.success('Votre dossier a été transmis à HAVEN pour vérification.');
      onClose?.();
    } catch (error) {
      console.error('Verification dossier submission failed', error);
      setVerificationError(error instanceof Error ? error.message : 'Impossible de transmettre le dossier.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // A validated account still needs the documents appropriate to the selected
  // mode. This matters when a tenant later starts publishing as an owner.
  const shouldShow = forced ? !isVerifiedForCurrentRole : propIsOpen;

  if (!shouldShow) return null;
  if (currentUser.status === 'BANNED') return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-haven-navy/60 p-4">
      <div className="max-w-lg rounded-3xl bg-white p-8 space-y-4">
        <h2 className="text-2xl font-bold text-haven-navy">Compte banni</h2>
        <p className="text-gray-600">Ce compte ne peut plus réserver, publier ou transmettre de dossier. Contactez Haven pour toute question.</p>
        {currentUser.rejectionReason && <p className="rounded-xl bg-red-50 p-4 text-red-700">{currentUser.rejectionReason}</p>}
        {onClose && <Button onClick={onClose}>Fermer</Button>}
      </div>
    </div>
  );

  const handleUploadDocument = (type: (typeof requiredDocuments)[number]['type']) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Le fichier dépasse la taille autorisée de 10 Mo.');
        return;
      }
      setIsUploading(true);
      void (async () => {
        try {
          const documentDataUrl = await prepareVerificationDocument(file);
          await apiService.users.uploadDocument(currentUser.id, type, documentDataUrl);
          await refreshUser();
          toast.success('Pièce d’identité ajoutée.');
        } catch (error) {
          console.error("Erreur lors de l'envoi du justificatif", error);
          toast.error(error instanceof Error ? error.message : "Impossible d’enregistrer le justificatif. Réessayez plus tard.");
        } finally {
          setIsUploading(false);
        }
      })();
    };
    input.click();
  };

  const verificationSteps = [
    { label: 'Coordonnées', complete: hasSavedDetails },
    { label: 'E-mail', complete: currentUser.emailVerified === true },
    { label: 'Téléphone', complete: hasRequiredPhoneNumber(currentUser) },
    { label: 'Document', complete: isComplete },
  ];

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-haven-navy/55 px-3 py-4 backdrop-blur-sm animate-fade-in sm:px-6 sm:py-6">
      <div className="flex min-h-full items-center justify-center">
        <section aria-labelledby="account-status-title" className="relative my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white shadow-2xl animate-scale-in sm:max-h-[calc(100dvh-3rem)] sm:rounded-[2rem]">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-100 px-5 py-5 sm:px-8 sm:py-6">
            <div className="flex min-w-0 items-center gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${currentUser.status === 'REJECTED' ? 'bg-red-50 text-haven-red' : isVerifiedForCurrentRole ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {currentUser.status === 'REJECTED' ? <XCircle size={24} /> : isVerifiedForCurrentRole ? <ShieldCheck size={24} /> : <Clock size={24} />}
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Vérification du compte</p>
                <h2 id="account-status-title" className="truncate text-xl font-bold tracking-tight text-haven-navy sm:text-2xl">{isVerifiedForCurrentRole ? 'Profil vérifié' : currentUser.status === 'REJECTED' ? 'Dossier à corriger' : isSubmittedForReview ? 'Dossier en cours de vérification' : 'Complétez votre profil'}</h2>
              </div>
            </div>
            {onClose && <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-haven-navy"><XCircle size={22} /></button>}
          </header>

          <div className="overflow-y-auto px-5 py-5 sm:px-8 sm:py-7">
            <div className={`mb-6 rounded-2xl border p-4 sm:p-5 ${currentUser.status === 'REJECTED' ? 'border-red-100 bg-red-50' : isVerifiedForCurrentRole ? 'border-green-100 bg-green-50' : 'border-blue-100 bg-blue-50/70'}`}>
              <p className="text-sm leading-relaxed text-gray-700 sm:text-[15px]">{isVerifiedForCurrentRole ? 'Votre profil est vérifié. Les fonctionnalités de ce mode sont disponibles.' : currentUser.status === 'REJECTED' ? 'Votre dossier nécessite une correction avant de pouvoir être vérifié.' : isSubmittedForReview ? 'Votre dossier a bien été transmis. Un administrateur vérifiera votre identité avant d’ouvrir l’accès aux réservations et à la publication.' : 'Enregistrez vos coordonnées et votre numéro de téléphone, confirmez votre e-mail, puis transmettez votre pièce d’identité pour contrôle.'}</p>
              {!isVerifiedForCurrentRole && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">{verificationSteps.map((step, index) => <div key={step.label} className="flex min-w-0 items-center gap-2 rounded-xl bg-white/80 px-2.5 py-2 sm:px-3"><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.complete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{step.complete ? <CheckCircle2 size={15} /> : index + 1}</span><span className="truncate text-[11px] font-semibold text-gray-600 sm:text-xs">{step.label}</span></div>)}</div>}
            </div>

            {currentUser.status === 'REJECTED' && currentUser.rejectionReason && <div className="mb-6 flex gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-left"><AlertCircle className="mt-0.5 shrink-0 text-haven-red" size={18} /><div><p className="text-sm font-bold text-haven-red">Motif du refus</p><p className="mt-1 text-sm leading-relaxed text-gray-700">{currentUser.rejectionReason}</p></div></div>}

            {!isVerifiedForCurrentRole && <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-2xl border border-gray-200 p-4 sm:p-5">
                <div className="mb-4"><h3 className="font-bold text-haven-navy">Vos coordonnées</h3><p className="mt-1 text-xs leading-relaxed text-gray-500">Ces informations servent à sécuriser votre compte et votre séjour.</p></div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-gray-500">Prénom<input autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Votre prénom" className="mt-1.5 block w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-haven-navy outline-none transition focus:border-haven-navy focus:ring-2 focus:ring-haven-navy/10" /></label>
                  <label className="text-xs font-semibold text-gray-500">Nom<input autoComplete="family-name" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Votre nom" className="mt-1.5 block w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-haven-navy outline-none transition focus:border-haven-navy focus:ring-2 focus:ring-haven-navy/10" /></label>
                </div>
                <div className="mt-3 text-xs font-semibold text-gray-500"><span>Date de naissance</span><BirthDateInput key={currentUser.id} value={birthDate} onChange={setBirthDate} /></div>
                <div className="mt-4 rounded-xl bg-gray-50 p-3.5"><div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><p className="text-[11px] font-semibold text-gray-500">Adresse e-mail</p><p className="mt-0.5 break-all text-sm font-semibold text-haven-navy">{currentUser.email}</p></div><span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${currentUser.emailVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}><span className={`h-1.5 w-1.5 rounded-full ${currentUser.emailVerified ? 'bg-green-600' : 'bg-amber-600'}`} />{currentUser.emailVerified ? 'Confirmée' : 'À confirmer'}</span></div>
                  {!currentUser.emailVerified && <div className="mt-3 space-y-2">
                    {emailLinkSent && <p className="text-xs leading-relaxed text-gray-600">Ouvrez le lien reçu à cette adresse, puis revenez ici pour terminer la confirmation.</p>}
                    {emailError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">{emailError}</p>}
                    <Button fullWidth variant="outline" disabled={isVerifyingEmail || emailWaitSeconds > 0} onClick={() => void sendEmailLink()} className="rounded-xl">{isVerifyingEmail ? 'Veuillez patienter…' : emailWaitSeconds > 0 ? `Nouvel envoi possible dans ${emailWaitSeconds} s` : emailLinkSent ? 'Renvoyer l’e-mail de validation' : 'Recevoir un e-mail de validation'}</Button>
                    <button type="button" onClick={() => void confirmEmailLink()} disabled={isVerifyingEmail} className="text-xs font-semibold text-haven-navy underline underline-offset-2 disabled:opacity-50">J’ai confirmé mon adresse</button>
                  </div>}
                </div>
                <label className="mt-4 block text-xs font-semibold text-gray-500">Téléphone (obligatoire)<input disabled={currentUser.phoneVerified === true} required autoComplete="tel" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+33 6 12 34 56 78" className="mt-1.5 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-haven-navy outline-none transition focus:border-haven-navy focus:ring-2 focus:ring-haven-navy/10" /></label>
                <p className="mt-2 text-xs text-gray-500">Renseignez un numéro auquel vous pouvez être joint.</p>
              </section>

              <section className="flex flex-col rounded-2xl border border-gray-200 p-4 sm:p-5">
                <div className="mb-4 flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-haven-navy/5 text-haven-navy"><FileText size={20} /></div><div><h3 className="font-bold text-haven-navy">Justificatif d’identité</h3><p className="mt-1 text-xs leading-relaxed text-gray-500">Carte nationale d’identité ou passeport en cours de validité.</p></div></div>
                <div className="flex flex-1 flex-col justify-between gap-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/70 p-4"><div><p className="text-sm font-semibold text-gray-700">Un document suffit</p><p className="mt-1 text-xs leading-relaxed text-gray-500">Photos jusqu’à 10 Mo avant optimisation. PDF limités à 600 Ko.</p></div>
                  {requiredDocuments.map(document => { const uploaded = isDocumentUploaded(document.type); return <div key={document.type} className="rounded-xl border border-gray-200 bg-white p-3.5"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-haven-navy">{document.label}</p><p className="mt-1 text-xs text-gray-500">{uploaded ? 'Document reçu · validation manuelle à venir' : 'PNG, JPG ou PDF'}</p></div>{uploaded && <CheckCircle2 className="shrink-0 text-green-600" size={20} />}</div><Button variant={uploaded ? 'outline' : 'primary'} fullWidth onClick={() => handleUploadDocument(document.type)} disabled={isUploading} className="mt-3 flex items-center justify-center gap-2 rounded-xl">{isUploading ? <Clock className="animate-spin" size={18} /> : <Upload size={18} />}{uploaded ? 'Remplacer le document' : 'Choisir un document'}</Button></div>; })}
                </div>
              </section>
            </div>}

            {!isVerifiedForCurrentRole && !currentUser.legalAccepted && <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="font-bold text-haven-navy">Conditions générales</h3>
              <p className="mt-1 text-sm text-gray-500">À accepter avant l’envoi de votre dossier pour validation.</p>
              {terms ? <>
                <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-haven-red">Lire les conditions générales</summary><div className="prose prose-sm mt-3 max-h-64 max-w-none overflow-y-auto rounded-xl bg-gray-50 p-4"><ReactMarkdown>{terms.content}</ReactMarkdown></div></details>
                <label className="mt-4 flex items-start gap-3 text-sm text-haven-navy"><input type="checkbox" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} className="mt-1" />J’ai lu et j’accepte les conditions générales de Haven.</label>
              </> : termsError ? <div role="alert" className="mt-3 text-sm text-red-700">{termsError}<button type="button" onClick={() => void loadTerms()} className="ml-2 underline">Réessayer</button></div> : <p className="mt-3 text-sm text-gray-500">Chargement des conditions générales…</p>}
            </section>}

            {isComplete && !isVerifiedForCurrentRole && (isSubmittedForReview
              ? <p className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-haven-navy">Dossier transmis à HAVEN. La validation de votre compte reste en attente de l’examen d’un administrateur.</p>
              : isVerificationReadyToSubmit(currentUser)
                ? <div className="mt-5 rounded-2xl border border-green-100 bg-green-50 p-4"><p className="mb-3 text-sm text-green-800">Tout est prêt. Envoyez votre dossier pour validation manuelle par HAVEN.</p><Button fullWidth disabled={isSubmitting || (!currentUser.legalAccepted && (!terms || !termsAccepted))} onClick={() => void submitDocumentsForReview()} className="rounded-xl">{isSubmitting ? 'Transmission en cours…' : 'Transmettre mon dossier à HAVEN'}</Button></div>
                : <p className="mt-4 rounded-xl bg-amber-50 p-3 text-center text-xs font-semibold leading-relaxed text-amber-800">Pièce reçue. Enregistrez vos coordonnées avec un numéro de téléphone valide et confirmez votre e-mail pour transmettre le dossier.</p>)}
          </div>

          {(!isVerifiedForCurrentRole || onClose) && <footer className="shrink-0 border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:px-8">
            {verificationError && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm leading-relaxed text-red-700">{verificationError}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              {!isVerifiedForCurrentRole && <Button disabled={isSavingDetails} onClick={() => void saveDetails()} className="rounded-xl">{isSavingDetails ? 'Enregistrement…' : 'Enregistrer mes coordonnées'}</Button>}
              {onClose && <Button variant="ghost" onClick={onClose} className="rounded-xl">Plus tard</Button>}
            </div>
          </footer>}
        </section>
      </div>
    </div>
  );
};
