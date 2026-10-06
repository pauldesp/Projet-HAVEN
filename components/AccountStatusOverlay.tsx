
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, Clock, XCircle, LogOut, ShieldCheck, Upload, FileText, CheckCircle2, Phone } from 'lucide-react';
import { Button } from './Button';
import { apiService } from '../services/api';
import { UserRole } from '../types';
import { toast } from 'sonner';
import { RecaptchaVerifier, linkWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { auth } from '../firebase';
import { prepareVerificationDocument } from '../services/verificationDocument';

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
  const { currentUser, accountRole, logout, refreshUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDocumentTypes, setUploadedDocumentTypes] = useState<string[]>([]);
  const [firstName, setFirstName] = useState(currentUser?.firstName || '');
  const [lastName, setLastName] = useState(currentUser?.lastName || '');
  const [birthDate, setBirthDate] = useState(currentUser?.birthDate || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [smsCode, setSmsCode] = useState('');
  const [smsConfirmation, setSmsConfirmation] = useState<ConfirmationResult | null>(null);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setFirstName(currentUser.firstName || '');
    setLastName(currentUser.lastName || '');
    setBirthDate(currentUser.birthDate || '');
    setPhone(currentUser.phone || '');
  }, [currentUser?.id]);
  useEffect(() => () => recaptchaVerifier.current?.clear(), []);

  // If not forced and not explicitly open, don't show anything
  if (!currentUser || currentUser.role === 'ADMIN') return null;
  
  const verificationRole = accountRole ?? currentUser.role;
  const requiredDocuments = [
    { type: 'idCard' as const, label: 'Pièce d’identité', detail: 'Carte nationale d’identité ou passeport en cours de validité.' },
  ];

  const isDocumentUploaded = (type: keyof NonNullable<typeof currentUser.documents>) =>
    Boolean(currentUser.documents?.[type]) || uploadedDocumentTypes.includes(type);
  const isComplete = requiredDocuments.every(document => isDocumentUploaded(document.type));
  const isApproved = currentUser.status === 'APPROVED';
  const isVerifiedForCurrentRole = isApproved && isComplete && currentUser.emailVerified === true && currentUser.phoneVerified === true && currentUser.identityVerified === true;
  const normalizePhone = (value: string) => {
    const compact = value.trim().replace(/[\s().-]/g, '');
    if (compact.startsWith('+')) return compact;
    if (compact.startsWith('00')) return `+${compact.slice(2)}`;
    if (compact.startsWith('0')) return `+33${compact.slice(1)}`;
    return `+${compact}`;
  };
  const savePersonalDetails = async () => {
    if (!currentUser || !firstName.trim() || !lastName.trim() || !birthDate || !phone.trim()) {
      setVerificationError('Renseignez votre prénom, votre nom, votre date de naissance et votre téléphone.');
      return false;
    }
    const normalizedPhone = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setVerificationError('Saisissez un numéro avec son indicatif, par exemple +33 6 12 34 56 78.');
      return false;
    }
    await apiService.users.updatePersonalDetails(currentUser.id, { firstName: firstName.trim(), lastName: lastName.trim(), birthDate, phone: normalizedPhone });
    setPhone(normalizedPhone);
    return true;
  };
  const sendPhoneCode = async () => {
    if (!currentUser) return;
    setVerificationError('');
    setIsVerifyingPhone(true);
    try {
      if (!await savePersonalDetails()) return;
      recaptchaVerifier.current?.clear();
      recaptchaVerifier.current = new RecaptchaVerifier(auth, 'account-status-recaptcha', { size: 'invisible' });
      const result = await linkWithPhoneNumber(auth.currentUser!, normalizePhone(phone), recaptchaVerifier.current);
      setSmsConfirmation(result);
      toast.success('Code SMS envoyé.');
    } catch (error) {
      console.error('SMS verification could not start', error);
      setVerificationError('Impossible d’envoyer le SMS. Vérifiez le numéro. Si le problème persiste, le fournisseur Téléphone doit être activé dans Firebase Authentication.');
    } finally {
      setIsVerifyingPhone(false);
    }
  };
  const confirmPhoneCode = async () => {
    if (!currentUser || !smsConfirmation) return;
    setVerificationError('');
    setIsVerifyingPhone(true);
    try {
      if (!await savePersonalDetails()) return;
      await smsConfirmation.confirm(smsCode.trim());
      await apiService.users.confirmPhone();
      await refreshUser();
      setSmsConfirmation(null);
      setSmsCode('');
      toast.success('Numéro de téléphone confirmé.');
    } catch (error) {
      console.error('SMS verification failed', error);
      setVerificationError('Code invalide ou confirmation impossible. Vérifiez le code et réessayez.');
    } finally {
      setIsVerifyingPhone(false);
    }
  };
  const submitDocumentsForReview = async () => {
    try {
      if (!await savePersonalDetails()) return;
      await apiService.users.submitVerification(verificationRole === UserRole.OWNER ? 'OWNER' : 'TENANT');
      await refreshUser();
      toast.success('Votre dossier a été transmis à HAVEN pour vérification.');
    } catch (error) {
      console.error('Verification dossier submission failed', error);
      toast.error(error instanceof Error ? error.message : 'Impossible de transmettre le dossier.');
    }
  };

  // A validated account still needs the documents appropriate to the selected
  // mode. This matters when a tenant later starts publishing as an owner.
  const shouldShow = forced ? !isVerifiedForCurrentRole : propIsOpen;

  if (!shouldShow) return null;

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
          const dossierWillBeComplete = requiredDocuments.every(document =>
            document.type === type || isDocumentUploaded(document.type)
          );
          if (dossierWillBeComplete && currentUser.emailVerified && currentUser.phoneVerified) {
            await apiService.users.submitVerification(verificationRole === UserRole.OWNER ? 'OWNER' : 'TENANT');
          }
          await refreshUser();
          setUploadedDocumentTypes(previous => previous.includes(type) ? previous : [...previous, type]);
          toast.success(dossierWillBeComplete && currentUser.emailVerified && currentUser.phoneVerified ? 'Dossier transmis à HAVEN pour vérification.' : 'Pièce d’identité ajoutée.');
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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-haven-navy/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in border border-white/20">
        <div id="account-status-recaptcha" aria-hidden="true" />
        <div className={`p-10 text-center ${currentUser.status === 'REJECTED' ? 'bg-red-50' : isApproved ? 'bg-green-50' : 'bg-orange-50'}`}>
          
          {!isApproved && !onClose && !forced && (
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XCircle size={24} />
            </button>
          )}

          <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-6 shadow-lg ${
            currentUser.status === 'REJECTED' ? 'bg-haven-red text-white' : 
            isVerifiedForCurrentRole ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'
          }`}>
            {currentUser.status === 'REJECTED' ? <XCircle size={40} /> : 
             isVerifiedForCurrentRole ? <ShieldCheck size={40} /> : <Clock size={40} />}
          </div>
          
          <h2 className="text-3xl font-heading font-bold text-haven-navy mb-4 tracking-tight">
            {isVerifiedForCurrentRole ? 'Compte validé' :
             currentUser.status === 'REJECTED' ? 'Compte non conforme' : 'Vérification requise'}
          </h2>

          <div className="mb-4 flex flex-col items-center gap-1 opacity-30">
            <p className="text-[8px] font-mono text-gray-400">UID: {currentUser.id}</p>
            <p className="text-[8px] font-mono text-gray-400">Status: {currentUser.status || 'PENDING'}</p>
          </div>
          
          <p className="text-gray-600 leading-relaxed mb-8">
            {isVerifiedForCurrentRole
              ? "Votre compte est validé. Vous avez accès aux fonctionnalités de ce mode."
              : currentUser.status === 'REJECTED' 
              ? "Votre dossier n’a pas pu être validé. Veuillez transmettre à nouveau une pièce d’identité bien lisible."
              : "Complétez vos coordonnées, confirmez votre téléphone et transmettez votre pièce d’identité. HAVEN contrôlera votre identité avant de débloquer les réservations ou la mise en ligne."
            }
          </p>

          {currentUser.status === 'REJECTED' && currentUser.rejectionReason && (
            <div className="bg-white/80 border border-red-100 rounded-2xl p-6 mb-8 text-left">
              <span className="block text-[10px] font-black text-haven-red uppercase tracking-widest mb-2 flex items-center gap-2">
                <AlertCircle size={12} /> Motif du refus
              </span>
              <p className="text-sm text-gray-700 italic font-medium">
                "{currentUser.rejectionReason}"
              </p>
            </div>
          )}

          <div className="space-y-4">
            {!isVerifiedForCurrentRole && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6 text-left">
                <h3 className="font-bold text-haven-navy mb-3">Vos informations personnelles</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input aria-label="Prénom" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Prénom" className="min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                  <input aria-label="Nom" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Nom" className="min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                </div>
                <label className="mb-3 block text-xs text-gray-500">Date de naissance<input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-haven-navy" /></label>
                <label className="mb-3 block text-xs text-gray-500">Adresse e-mail <span className="font-semibold text-haven-navy">{currentUser.email}</span><span className={`ml-2 font-bold ${currentUser.emailVerified ? 'text-green-600' : 'text-amber-600'}`}>{currentUser.emailVerified ? 'Confirmée' : 'Non confirmée'}</span></label>
                <label className="mb-2 block text-xs text-gray-500">Téléphone<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+33 6 12 34 56 78" className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-haven-navy" /></label>
                {currentUser.phoneVerified ? <p className="mb-3 flex items-center gap-2 text-xs font-bold text-green-600"><Phone size={14}/> Téléphone confirmé par SMS</p> : (
                  <div className="mb-4 space-y-2">
                    {smsConfirmation && <input aria-label="Code de validation SMS" inputMode="numeric" autoComplete="one-time-code" value={smsCode} onChange={e => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Code SMS à 6 chiffres" maxLength={6} className="block w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-center tracking-[0.4em]" />}
                    <Button fullWidth variant="outline" disabled={isVerifyingPhone || Boolean(smsConfirmation && smsCode.length !== 6)} onClick={() => smsConfirmation ? void confirmPhoneCode() : void sendPhoneCode()}>
                      {isVerifyingPhone ? <Clock className="animate-spin" size={16}/> : <Phone size={16}/>} {smsConfirmation ? 'Confirmer le code SMS' : 'Recevoir un code SMS'}
                    </Button>
                  </div>
                )}
                {verificationError && <p role="alert" className="mb-3 text-xs text-red-600">{verificationError}</p>}
                <FileText className="mx-auto text-gray-300 mb-3" size={32} />
                <p className="text-sm text-gray-500 mb-4 text-center">
                  Les photos peuvent faire jusqu’à 10 Mo avant optimisation. Les PDF sont limités à 600 Ko.
                </p>
                <div className="space-y-3">
                  {requiredDocuments.map(document => {
                    const uploaded = isDocumentUploaded(document.type);
                    return (
                      <div key={document.type} className="rounded-xl border border-gray-100 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-haven-navy">{document.label}</p>
                            <p className="mt-1 text-xs leading-relaxed text-gray-500">{document.detail}</p>
                          </div>
                          {uploaded && <CheckCircle2 className="shrink-0 text-green-600" size={20} />}
                        </div>
                        <Button
                          variant={uploaded ? 'outline' : 'primary'}
                          fullWidth
                          onClick={() => handleUploadDocument(document.type)}
                          disabled={isUploading}
                          className="mt-3 flex items-center justify-center gap-2"
                        >
                          {isUploading ? <Clock className="animate-spin" size={18} /> : <Upload size={18} />}
                          {uploaded ? 'Remplacer le document' : 'Télécharger le document'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                {isComplete && (currentUser.emailVerified && currentUser.phoneVerified
                  ? <Button fullWidth className="mt-4" onClick={() => void submitDocumentsForReview()}>Transmettre mon dossier à HAVEN</Button>
                  : <p className="mt-4 text-center text-xs font-bold text-amber-700">Pièce reçue. Confirmez votre e-mail et votre téléphone ; un administrateur examinera ensuite votre dossier.</p>)}
              </div>
            )}

            <div className="flex gap-3">
              {onClose && (
                <Button 
                  variant="ghost" 
                  fullWidth 
                  onClick={onClose}
                  className="py-4 text-gray-400 hover:text-gray-600"
                >
                  Plus tard
                </Button>
              )}
              
              {!isVerifiedForCurrentRole && (
                <Button 
                  variant="outline" 
                  fullWidth 
                  onClick={() => logout()}
                  className="flex items-center justify-center gap-2 py-4 border-gray-200 text-gray-500 hover:bg-gray-50 rounded-2xl"
                >
                  <LogOut size={18} /> Déconnexion
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
