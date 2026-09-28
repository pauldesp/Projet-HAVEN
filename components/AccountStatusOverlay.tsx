
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, Clock, XCircle, LogOut, ShieldCheck, Upload, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';
import { apiService } from '../services/api';
import { UserRole } from '../types';
import { toast } from 'sonner';

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

  // If not forced and not explicitly open, don't show anything
  if (!currentUser || currentUser.role === 'ADMIN') return null;
  
  const verificationRole = accountRole ?? currentUser.role;
  const requiredDocuments = verificationRole === UserRole.OWNER
    ? [
        { type: 'idCard' as const, label: 'Pièce d’identité', detail: 'Carte nationale d’identité ou passeport en cours de validité.' },
        { type: 'proofOfOwnership' as const, label: 'Justificatif de propriété', detail: 'Taxe foncière, acte de propriété ou attestation notariale.' },
      ]
    : [
        { type: 'idCard' as const, label: 'Pièce d’identité', detail: 'Carte nationale d’identité ou passeport en cours de validité.' },
        { type: 'proofOfAddress' as const, label: 'Justificatif de domicile', detail: 'Document de moins de trois mois à votre nom.' },
      ];

  const isDocumentUploaded = (type: keyof NonNullable<typeof currentUser.documents>) =>
    Boolean(currentUser.documents?.[type]) || uploadedDocumentTypes.includes(type);
  const isComplete = requiredDocuments.every(document => isDocumentUploaded(document.type));
  const isApproved = currentUser.status === 'APPROVED';
  const isVerifiedForCurrentRole = isApproved && isComplete;

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
      if (file.size > 1.5 * 1024 * 1024) {
        toast.error('Le fichier dépasse la taille autorisée de 1,5 Mo.');
        return;
      }
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await apiService.users.uploadDocument(currentUser.id, type, reader.result as string);
          const dossierWillBeComplete = requiredDocuments.every(document =>
            document.type === type || isDocumentUploaded(document.type)
          );
          if (dossierWillBeComplete) {
            await apiService.users.submitVerification(verificationRole === UserRole.OWNER ? 'OWNER' : 'TENANT');
          }
          await refreshUser();
          setUploadedDocumentTypes(previous => previous.includes(type) ? previous : [...previous, type]);
          toast.success(dossierWillBeComplete ? 'Dossier transmis à HAVEN pour vérification.' : 'Justificatif ajouté.');
        } catch (error) {
          console.error("Erreur lors de l'envoi du justificatif", error);
          toast.error("Impossible d’enregistrer le justificatif. Réessayez plus tard.");
        } finally {
          setIsUploading(false);
        }
      };
      reader.onerror = () => setIsUploading(false);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-haven-navy/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in border border-white/20">
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
              ? "Vos justificatifs sont validés. Vous avez accès aux fonctionnalités de ce mode."
              : currentUser.status === 'REJECTED' 
              ? "Votre dossier n’a pas pu être validé. Veuillez transmettre à nouveau les justificatifs demandés, bien lisibles."
              : "Avant de publier un logement ou d’effectuer une réservation, vos justificatifs doivent être validés par HAVEN."
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
                <FileText className="mx-auto text-gray-300 mb-3" size={32} />
                <p className="text-sm text-gray-500 mb-4 text-center">
                  Les fichiers PNG, JPG ou PDF sont acceptés, dans la limite de 1,5 Mo par document.
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
                {isComplete && <p className="mt-4 text-center text-xs font-bold text-green-600">Dossier complet : vérification en cours.</p>}
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
