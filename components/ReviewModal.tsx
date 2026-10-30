
import React, { useState, useEffect } from 'react';
import { X, Star, Loader2, MessageSquare } from 'lucide-react';
import { Button } from './Button';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { userFacingErrorMessage } from '../services/errorHandling';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetName: string;
  targetType: 'LISTING' | 'USER';
  bookingId: string;
  onComplete?: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ 
  isOpen, 
  onClose, 
  targetId, 
  targetName, 
  targetType,
  bookingId,
  onComplete 
}) => {
  const { currentUser } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [platformRating, setPlatformRating] = useState(0);
  const [platformComment, setPlatformComment] = useState('');
  useEffect(() => { if (isOpen) { setRating(5); setComment(''); setPlatformRating(0); setPlatformComment(''); } }, [isOpen, bookingId]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', escape); };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!currentUser) return;
    if (targetType === 'LISTING' && platformComment.trim() && !platformRating) { toast.error('Choisissez une note pour Haven ou laissez cette partie vide.'); return; }
    setIsSubmitting(true);
    try {
      await apiService.reviews.create({ bookingId, targetId, targetType, rating, comment, ...(targetType === 'LISTING' && platformRating ? { platformFeedback: { rating: platformRating, comment: platformComment } } : {}) });
      
      if (onComplete) onComplete();
      onClose();
    } catch (e) {
      console.error("Error submitting review", e);
      toast.error(userFacingErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-haven-navy/40 backdrop-blur-md" onClick={onClose}></div>
      
      <div role="dialog" aria-modal="true" aria-label="Noter votre expérience" className="haven-dialog-panel relative bg-white rounded-[2.5rem] w-full max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl flex flex-col animate-fade-in-up">
        <div className="haven-dialog-footer p-4 pt-8 sm:p-8 text-center">
          <button onClick={onClose} aria-label="Fermer les avis" className="haven-touch-action absolute top-2 right-2 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X size={20} />
          </button>
          
          <div className="w-16 h-16 bg-haven-red/10 text-haven-red rounded-2xl flex items-center justify-center mx-auto mb-6">
            <MessageSquare size={32} />
          </div>
          
          <h2 className="font-heading font-bold text-2xl text-haven-navy mb-2">
            {targetType === 'LISTING' ? 'Notez votre séjour' : 'Notez votre colocataire'}
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            Partagez votre expérience avec <span className="font-bold text-haven-navy">{targetName}</span>
          </p>

          <div className="space-y-8">
            <div className="flex justify-center gap-1 sm:gap-4">
              {[1, 2, 3, 4, 5].map(star => (
                <button 
                  key={star}
                  type="button" aria-label={`Séjour : ${star} sur 5`} aria-pressed={rating === star}
                  onClick={() => setRating(star)}
                  className={`transition-all transform hover:scale-110 ${rating >= star ? 'text-yellow-400' : 'text-gray-200'}`}
                >
                  <Star size={40} className={rating >= star ? 'fill-current' : ''} />
                </button>
              ))}
            </div>

            <div className="text-left space-y-2">
              <label className="text-[10px] font-black text-haven-stone uppercase tracking-widest">Votre commentaire</label>
              <textarea 
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Racontez-nous comment s'est passé votre séjour..."
                className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:border-haven-navy text-sm"
              />
            </div>

            {targetType === 'LISTING' && <section className="space-y-4 rounded-2xl border border-gray-100 bg-haven-cream p-5 text-left">
              <div><h3 className="font-bold text-haven-navy">Et votre expérience sur Haven ?</h3><p className="mt-2 text-sm leading-relaxed text-gray-500">Ce retour facultatif est visible uniquement par les administrateurs Haven. Votre avis nous aidera à faire évoluer la plateforme.</p></div>
              <div role="group" aria-label="Votre note pour la plateforme Haven" className="flex gap-1">{[1, 2, 3, 4, 5].map(star => <button type="button" key={star} disabled={isSubmitting} aria-label={`Haven : ${star} sur 5`} aria-pressed={platformRating === star} onClick={() => setPlatformRating(star)} className={`flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-lg transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-haven-navy ${platformRating >= star ? 'text-yellow-400' : 'text-gray-300'}`}><Star size={28} className={platformRating >= star ? 'fill-current' : ''} /></button>)}</div>
              <label className="block text-sm text-haven-navy">Une suggestion pour améliorer Haven ?<textarea rows={3} maxLength={2000} disabled={isSubmitting} value={platformComment} onChange={event => setPlatformComment(event.target.value)} placeholder="Ce que vous avez apprécié, ce qui pourrait être plus simple…" className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-haven-navy" /></label>
              {(platformRating > 0 || platformComment) && <button type="button" disabled={isSubmitting} onClick={() => { setPlatformRating(0); setPlatformComment(''); }} className="text-xs font-bold text-gray-500 underline">Ne pas donner d’avis sur Haven</button>}
            </section>}

            <Button 
              fullWidth 
              size="lg" 
              onClick={handleSubmit} 
              disabled={isSubmitting}
            >
              {isSubmitting ? <><Loader2 className="animate-spin mr-2"/> Envoi...</> : "Publier mon avis"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
