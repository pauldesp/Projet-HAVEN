
import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, MessageSquare, HelpCircle, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { apiService } from '../services/api';
import { CONTACT_SUBJECTS, prepareContactRequest } from '../services/contactRequest';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { userFacingErrorMessage } from '../services/errorHandling';

export const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const id = globalThis.crypto?.randomUUID?.() || `contact_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      const request = prepareContactRequest(formData, id);

      await apiService.contactRequests.create(request);
      setIsSuccess(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (error) {
      console.error('Error sending contact request:', error);
      toast.error(error instanceof Error ? error.message : userFacingErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-haven-navy/5"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-heading font-bold text-haven-navy mb-4">Message envoyé !</h2>
          <p className="text-gray-600 mb-8">
            Votre message a bien été transmis à l’équipe Haven. Nous utiliserons les coordonnées indiquées pour vous répondre si nécessaire.
          </p>
          <button 
            onClick={() => setIsSuccess(false)}
            className="w-full py-4 bg-haven-navy text-white rounded-2xl font-bold hover:bg-haven-navy/90 transition-colors"
          >
            Envoyer un autre message
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Info Section */}
        <div>
          <h1 className="text-4xl font-heading font-bold text-haven-navy mb-6">Contacter Haven</h1>
          <p className="text-lg text-gray-600 mb-12">
            Un avis sur le site, une suggestion, un dysfonctionnement ou une réclamation sur notre service ? Écrivez à l’équipe Haven.
          </p>

          <div className="space-y-8">
            <div className="flex gap-6">
              <div className="w-12 h-12 bg-haven-red/10 rounded-2xl flex items-center justify-center shrink-0">
                <HelpCircle className="w-6 h-6 text-haven-red" />
              </div>
              <div>
                <h3 className="font-bold text-haven-navy mb-1">Questions et conseils</h3>
                <p className="text-gray-600 text-sm">Une question générale sur Haven ou une idée pour améliorer la plateforme ? Votre message est le bienvenu.</p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="w-12 h-12 bg-haven-navy/10 rounded-2xl flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-haven-navy" />
              </div>
              <div>
                <h3 className="font-bold text-haven-navy mb-1">Support technique</h3>
                <p className="text-gray-600 text-sm">Un bouton qui ne fonctionne pas, une erreur de connexion ou une page inaccessible ? Décrivez le dysfonctionnement du site.</p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="w-12 h-12 bg-haven-cream rounded-2xl flex items-center justify-center shrink-0">
                <MessageSquare className="w-6 h-6 text-haven-navy" />
              </div>
              <div>
                <h3 className="font-bold text-haven-navy mb-1">Partenariats</h3>
                <p className="text-gray-600 text-sm">Vous êtes une école ou une entreprise ? Discutons de la manière dont nous pouvons collaborer.</p>
              </div>
            </div>
          </div>

          <div className="mt-10 space-y-4 rounded-2xl border border-gray-100 bg-gray-50 p-6">
            <h3 className="font-bold text-haven-navy">Un problème pendant votre séjour ?</h3>
            <p className="text-sm text-gray-600"><strong>Incident dans le logement :</strong> panne, fuite ou équipement à réparer sont transmis au propriétaire depuis votre séjour.</p>
            <p className="text-sm text-gray-600"><strong>Intervention de Haven :</strong> conflit, logement insalubre, ménage non fait ou incident non résolu passent par un signalement.</p>
            <Link to="/dashboard" className="inline-block text-sm font-bold text-haven-red underline underline-offset-4">Accéder à mon espace et à mes séjours</Link>
          </div>
        </div>

        {/* Form Section */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-haven-navy/5">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-haven-navy mb-2">Nom complet</label>
                <input 
                  type="text"
                  maxLength={99}
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-haven-red/20 focus:border-haven-red transition-all"
                  placeholder="Jean Dupont"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-haven-navy mb-2">Email</label>
                <input 
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-haven-red/20 focus:border-haven-red transition-all"
                  placeholder="jean@exemple.fr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-haven-navy mb-2">Téléphone</label>
              <input 
                type="tel"
                maxLength={19}
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-haven-red/20 focus:border-haven-red transition-all"
                placeholder="06 12 34 56 78"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-haven-navy mb-2">Motif du contact</label>
              <select 
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-haven-red/20 focus:border-haven-red transition-all"
              >
                <option value="">Sélectionnez un sujet</option>
                {CONTACT_SUBJECTS.map(subject => <option key={subject} value={subject}>{subject}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-haven-navy mb-2">Message</label>
              <textarea 
                required
                rows={6}
                maxLength={9999}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-haven-red/20 focus:border-haven-red transition-all resize-none"
                placeholder="Votre avis, votre suggestion ou votre demande à propos de Haven…"
              />
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-haven-red text-white rounded-2xl font-bold hover:bg-haven-red/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-haven-red/20"
            >
              {isSubmitting ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Envoyer le message
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
