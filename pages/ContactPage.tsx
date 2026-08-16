
import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, MessageSquare, HelpCircle, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { apiService } from '../services/api';
import { ContactRequest } from '../types';

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
    setIsSubmitting(true);

    try {
      const request: ContactRequest = {
        id: crypto.randomUUID(),
        ...formData,
        timestamp: new Date().toISOString(),
        status: 'NEW'
      };

      await apiService.contactRequests.create(request);
      setIsSuccess(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (error) {
      console.error('Error sending contact request:', error);
      alert('Une erreur est survenue lors de l\'envoi de votre message. Veuillez réessayer.');
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
            Merci de nous avoir contactés. Notre équipe vous répondra dans les plus brefs délais (généralement sous 24h).
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
          <h1 className="text-4xl font-heading font-bold text-haven-navy mb-6">Comment pouvons-nous vous aider ?</h1>
          <p className="text-lg text-gray-600 mb-12">
            Que vous soyez locataire, propriétaire ou simplement curieux, notre équipe est là pour répondre à toutes vos questions sur HAVEN.
          </p>

          <div className="space-y-8">
            <div className="flex gap-6">
              <div className="w-12 h-12 bg-haven-red/10 rounded-2xl flex items-center justify-center shrink-0">
                <HelpCircle className="w-6 h-6 text-haven-red" />
              </div>
              <div>
                <h3 className="font-bold text-haven-navy mb-1">Questions fréquentes</h3>
                <p className="text-gray-600 text-sm">Consultez notre centre d'aide pour trouver des réponses immédiates aux questions les plus courantes.</p>
              </div>
            </div>

            <div className="flex gap-6">
              <div className="w-12 h-12 bg-haven-navy/10 rounded-2xl flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-haven-navy" />
              </div>
              <div>
                <h3 className="font-bold text-haven-navy mb-1">Support technique</h3>
                <p className="text-gray-600 text-sm">Un problème avec votre compte ou une annonce ? Notre équipe technique intervient rapidement.</p>
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

          <div className="mt-12 p-8 bg-haven-navy rounded-3xl text-white">
            <h3 className="text-xl font-bold mb-4">Besoin d'une réponse urgente ?</h3>
            <p className="text-haven-cream/80 mb-6">Notre support client est disponible par téléphone du lundi au vendredi de 9h à 18h.</p>
            <div className="flex items-center gap-3 text-lg font-bold">
              <span className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">📞</span>
              01 23 45 67 89
            </div>
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
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-haven-red/20 focus:border-haven-red transition-all"
                placeholder="06 12 34 56 78"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-haven-navy mb-2">Sujet</label>
              <select 
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-haven-red/20 focus:border-haven-red transition-all"
              >
                <option value="">Sélectionnez un sujet</option>
                <option value="Question générale">Question générale</option>
                <option value="Problème technique">Problème technique</option>
                <option value="Réservation">Question sur une réservation</option>
                <option value="Propriétaire">Devenir propriétaire</option>
                <option value="Autre">Autre</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-haven-navy mb-2">Message</label>
              <textarea 
                required
                rows={6}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-haven-red/20 focus:border-haven-red transition-all resize-none"
                placeholder="Comment pouvons-nous vous aider ?"
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
