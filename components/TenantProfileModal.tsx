
import React from 'react';
import { User } from '../types';
import { X, CheckCircle, GraduationCap, Briefcase, MessageCircle } from 'lucide-react';
import { Button } from './Button';

interface TenantProfileModalProps {
  user: User | null;
  onClose: () => void;
}

export const TenantProfileModal: React.FC<TenantProfileModalProps> = ({ user, onClose }) => {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-haven-navy/40 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-3xl w-full max-w-sm shadow-2xl flex flex-col items-center p-8 animate-fade-in-up">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full text-gray-500">
          <X size={20} />
        </button>

        <div className="relative mb-4">
          <img 
            src={user.avatarUrl} 
            alt={user.firstName} 
            className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
          />
          {user.isVerified && (
            <div className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow-sm">
              <CheckCircle size={20} className="text-blue-500 fill-blue-500 bg-white rounded-full" />
            </div>
          )}
        </div>

        <h2 className="font-heading font-bold text-2xl text-haven-navy mb-1">
          {user.firstName} {user.lastName.charAt(0)}.
        </h2>
        <p className="text-sm text-gray-400 mb-6">Colocataire certifié</p>

        <div className="w-full space-y-4 mb-8">
          {user.school && (
            <div className="flex items-center gap-3 text-gray-700 bg-gray-50 p-3 rounded-xl">
              <GraduationCap className="text-haven-navy" size={20} />
              <div className="text-sm">
                <span className="block text-xs text-gray-400 uppercase font-bold">École</span>
                {user.school}
              </div>
            </div>
          )}
          
          {user.job && (
            <div className="flex items-center gap-3 text-gray-700 bg-gray-50 p-3 rounded-xl">
              <Briefcase className="text-haven-navy" size={20} />
              <div className="text-sm">
                 <span className="block text-xs text-gray-400 uppercase font-bold">Activité</span>
                 {user.job}
              </div>
            </div>
          )}

          {user.bio && (
            <div className="bg-haven-cream p-4 rounded-xl text-sm text-gray-600 italic border border-gray-100 text-center">
              "{user.bio}"
            </div>
          )}
        </div>

        <Button fullWidth onClick={() => alert("Fonctionnalité de messagerie à venir !")}>
          <MessageCircle size={18} className="mr-2" />
          Envoyer un message
        </Button>
      </div>
    </div>
  );
};
