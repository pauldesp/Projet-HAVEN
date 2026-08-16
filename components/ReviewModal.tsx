
import React, { useState } from 'react';
import { X, Star, Loader2, MessageSquare } from 'lucide-react';
import { Button } from './Button';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetName: string;
  targetType: 'LISTING' | 'USER';
  onComplete?: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ 
  isOpen, 
  onClose, 
  targetId, 
  targetName, 
  targetType,
  onComplete 
}) => {
  const { currentUser } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      const reviewData = {
        id: `rev-${Date.now()}`,
        authorId: currentUser.id,
        targetId,
        targetType,
        rating,
        comment,
        createdAt: new Date().toISOString(),
        authorName: `${currentUser.firstName} ${currentUser.lastName.charAt(0)}.`,
        authorAvatarUrl: currentUser.avatarUrl
      };
      
      // API call
      await apiService.reviews.create(reviewData);
      
      // If it's a listing review, update the listing's average rating
      if (targetType === 'LISTING') {
        await apiService.listings.submitReview(targetId, rating);
      }
      
      if (onComplete) onComplete();
      onClose();
    } catch (e) {
      console.error("Error submitting review", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-haven-navy/40 backdrop-blur-md" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col animate-fade-in-up">
        <div className="p-8 text-center">
          <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
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
            <div className="flex justify-center gap-4">
              {[1, 2, 3, 4, 5].map(star => (
                <button 
                  key={star} 
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

            <Button 
              fullWidth 
              size="lg" 
              onClick={handleSubmit} 
              disabled={!comment || isSubmitting}
            >
              {isSubmitting ? <><Loader2 className="animate-spin mr-2"/> Envoi...</> : "Publier mon avis"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
