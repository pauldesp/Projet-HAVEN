
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, Clock, XCircle, LogOut, ShieldCheck, Upload, FileText, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';
import { apiService } from '../services/api';

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
  const { currentUser, logout } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // If not forced and not explicitly open, don't show anything
  if (!currentUser || currentUser.role === 'ADMIN') return null;
  
  const isApproved = currentUser.status === 'APPROVED';
  
  // If forced mode (like at login if we wanted to block), show if not approved
  // Otherwise, only show if isOpen is true
  const shouldShow = forced ? !isApproved : propIsOpen;

  if (!shouldShow) return null;

  const handleUploadId = async () => {
    setIsUploading(true);
    try {
      // Simulate ID upload
      const mockIdUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${currentUser.lastName}&backgroundColor=f1f5f9&fontSize=30&bold=true`;
      await apiService.users.updateProfile({
        ...currentUser,
        idDocumentUrl: mockIdUrl,
        status: 'PENDING' // Reset to pending if they were rejected and are re-uploading
      });
      setUploadSuccess(true);
      setTimeout(() => {
        setUploadSuccess(false);
        if (onClose) onClose();
      }, 2000);
    } catch (e) {
      console.error("Erreur lors de l'envoi de la pièce d'identité", e);
    } finally {
      setIsUploading(false);
    }
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
            isApproved ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'
          }`}>
            {currentUser.status === 'REJECTED' ? <XCircle size={40} /> : 
             isApproved ? <ShieldCheck size={40} /> : <Clock size={40} />}
          </div>
          
          <h2 className="text-3xl font-heading font-bold text-haven-navy mb-4 tracking-tight">
            {isApproved ? 'Identité Vérifiée' : 
             currentUser.status === 'REJECTED' ? 'Compte non conforme' : 'Vérification requise'}
          </h2>

          <div className="mb-4 flex flex-col items-center gap-1 opacity-30">
            <p className="text-[8px] font-mono text-gray-400">UID: {currentUser.id}</p>
            <p className="text-[8px] font-mono text-gray-400">Status: {currentUser.status || 'PENDING'}</p>
          </div>
          
          <p className="text-gray-600 leading-relaxed mb-8">
            {isApproved 
              ? "Votre identité a été validée. Vous avez désormais accès à toutes les fonctionnalités de la plateforme."
              : currentUser.status === 'REJECTED' 
              ? "Désolé, votre pièce d'identité n'a pas pu être validée. Veuillez en fournir une nouvelle plus lisible."
              : "Pour garantir la sécurité de HAVEN, nous devons vérifier votre identité avant que vous ne puissiez publier une annonce ou effectuer une réservation."
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
            {!isApproved && (
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
                <FileText className="mx-auto text-gray-300 mb-3" size={32} />
                <p className="text-sm text-gray-500 mb-4">
                  Veuillez télécharger une copie de votre carte d'identité ou passeport (recto-verso).
                </p>
                <Button 
                  variant={uploadSuccess ? 'secondary' : 'primary'}
                  fullWidth
                  onClick={handleUploadId}
                  disabled={isUploading || uploadSuccess}
                  className="flex items-center justify-center gap-2"
                >
                  {isUploading ? <Clock className="animate-spin" size={18} /> : 
                   uploadSuccess ? <CheckCircle2 size={18} /> : <Upload size={18} />}
                  {uploadSuccess ? 'Document envoyé !' : 'Télécharger ma pièce d\'identité'}
                </Button>
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
              
              {!isApproved && (
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
