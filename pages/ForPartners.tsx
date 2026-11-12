import React, { useState } from 'react';
import { Building2, GraduationCap, ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '../services/api';
import { prepareContactRequest } from '../services/contactRequest';

export const ForPartners: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    organization: '',
    orgType: 'SCHOOL',
    email: '',
    phone: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.name || !formData.email || !formData.phone || !formData.message) {
      toast.error('Veuillez remplir les champs obligatoires (nom, e-mail, téléphone, message).');
      return;
    }
    setIsSubmitting(true);
    try {
      // Sent like any contact request: it appears in the back office, Contacts tab.
      const type = { SCHOOL: 'Université / grande école', COMPANY: 'Entreprise / cabinet RH', ASSOCIATION: 'Association / autre' }[formData.orgType] || 'Autre';
      const id = globalThis.crypto?.randomUUID?.() || `contact_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      const request = prepareContactRequest({
        name: formData.name, email: formData.email, phone: formData.phone, subject: 'Partenariat',
        message: `Organisme : ${formData.organization || 'non précisé'} (${type})\n\n${formData.message}`,
      }, id);
      await apiService.contactRequests.create(request);
      toast.success('Demande envoyée.', { description: 'L’équipe Haven vous répondra par e-mail.', duration: 5000 });
      setFormData({ name: '', organization: '', orgType: 'SCHOOL', email: '', phone: '', message: '' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'La demande n’a pas pu être envoyée. Réessayez.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="bg-haven-cream min-h-screen py-8 sm:py-16 px-4 sm:px-6 lg:px-8 mt-4 sm:mt-12 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-8 sm:mb-14">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">
            Écoles et entreprises
          </span>
          <h1 className="text-[1.75rem] sm:text-5xl font-heading font-black text-haven-navy mt-3 sm:mt-4 mb-3 sm:mb-6 leading-tight">
            Un logement pour chaque stage, <br className="hidden sm:inline" />alternance ou mission
          </h1>
          <p className="text-sm sm:text-lg text-gray-500 max-w-2xl mx-auto">
            Vos étudiants ou collaborateurs arrivent pour quelques semaines, un semestre ou des périodes en alternance ? Haven leur propose des chambres meublées en colocation, vérifiées, pour la durée exacte de leur présence.
          </p>
        </div>

        {/* For whom: three plain benefits each. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-14">
          {([
            { Icon: GraduationCap, tone: 'bg-indigo-50 text-indigo-600', check: 'text-indigo-600', title: 'Écoles et universités', who: 'Services logement, relations internationales, bureaux des élèves',
              items: ['Une chambre pour un semestre, un stage ou un échange', 'Plusieurs périodes réservées en une fois pour les alternants', 'Pas de garant : chaque séjour est payé à la réservation'] },
            { Icon: Building2, tone: 'bg-haven-red/5 text-haven-red', check: 'text-haven-red', title: 'Entreprises', who: 'Ressources humaines, intégration, mobilité',
              items: ['Une chambre prête à vivre dès le premier jour', 'Des séjours de quelques nuits à plusieurs mois', 'Un prix tout compris, connu à l’avance'] },
          ]).map(({ Icon, tone, check, title, who, items }) => (
            <div key={title} className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] p-6 sm:p-8 border border-gray-100 shadow-premium">
              <div className={`w-12 h-12 ${tone} rounded-2xl flex items-center justify-center mb-5`}><Icon size={24} aria-hidden="true" /></div>
              <h2 className="text-xl sm:text-2xl font-heading font-black text-haven-navy">{title}</h2>
              <p className="mt-1 text-xs text-gray-400">{who}</p>
              <ul className="mt-5 space-y-3">
                {items.map(item => <li key={item} className="flex gap-2.5 text-sm text-gray-600"><Check size={16} className={`${check} shrink-0 mt-0.5`} aria-hidden="true" />{item}</li>)}
              </ul>
            </div>
          ))}
        </div>

        {/* How it works with Haven, in three steps. */}
        <section className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] p-6 sm:p-10 border border-gray-100 shadow-premium mb-8 sm:mb-14" aria-labelledby="partners-how">
          <h2 id="partners-how" className="font-heading font-black text-center text-xl sm:text-2xl text-haven-navy mb-8">Comment ça se passe</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {[
              ['Vous nous contactez', 'Dites-nous combien de personnes, dans quelles villes et à quelles périodes.'],
              ['Vous relayez Haven', 'Nous vous fournissons une présentation à transmettre à vos étudiants ou collaborateurs.'],
              ['Ils réservent', 'Chacun crée son compte, le fait vérifier et réserve directement la chambre qui lui convient.'],
            ].map(([title, text], index) => (
              <li key={title} className="text-center sm:text-left">
                <span className="mx-auto sm:mx-0 flex h-9 w-9 items-center justify-center rounded-full bg-haven-navy text-sm font-bold text-white">{index + 1}</span>
                <p className="mt-3 font-heading text-lg font-black text-haven-navy">{title}</p>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Contact */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-start">
          <div className="lg:col-span-5">
            <div className="bg-haven-navy rounded-[1.75rem] sm:rounded-[2.5rem] p-6 sm:p-8 text-white shadow-premium">
              <h2 className="font-heading font-bold text-xl sm:text-2xl">Parlons-en</h2>
              <p className="mt-3 text-sm text-gray-300 leading-relaxed">Pour vous répondre au mieux, précisez dans votre message :</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-200">
                {['le nombre de personnes à loger', 'les villes concernées', 'les périodes (dates ou rythme d’alternance)'].map(item => <li key={item} className="flex gap-2.5"><Check size={16} className="mt-0.5 shrink-0 text-haven-red" aria-hidden="true" />{item}</li>)}
              </ul>
              <p className="mt-6 pt-5 border-t border-white/10 text-xs text-gray-400">L’équipe Haven vous répond par e-mail.</p>
            </div>
          </div>

          {/* Partner register form */}
          <div className="lg:col-span-7 bg-white rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-10 border border-gray-100 shadow-premium">
            <h2 className="font-heading font-bold text-xl sm:text-2xl text-haven-navy mb-2">Nous contacter</h2>
            <p className="text-xs text-gray-400 mb-6 font-medium">Les champs marqués d’un astérisque sont obligatoires.</p>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Votre nom complet *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Prénom Nom"
                    className="w-full text-sm font-medium px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:outline-none focus:border-haven-navy transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Établissement / Organisme</label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={e => setFormData(p => ({ ...p, organization: e.target.value }))}
                    placeholder="Nom de l’école ou de l’entreprise"
                    className="w-full text-sm font-medium px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:outline-none focus:border-haven-navy transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Vous êtes</label>
                  <select
                    value={formData.orgType}
                    onChange={e => setFormData(p => ({ ...p, orgType: e.target.value }))}
                    className="w-full text-sm font-medium text-haven-navy px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:outline-none focus:border-haven-navy transition-all"
                  >
                    <option value="SCHOOL">Une école ou une université</option>
                    <option value="COMPANY">Une entreprise</option>
                    <option value="ASSOCIATION">Une association ou autre</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">E-mail professionnel *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    placeholder="prenom.nom@organisation.fr"
                    className="w-full text-sm font-medium px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:outline-none focus:border-haven-navy transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Numéro de téléphone *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+33 6 12 34 56 78"
                  className="w-full text-sm font-medium px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:outline-none focus:border-haven-navy transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Votre besoin *</label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
                  placeholder="Nombre de personnes, villes, périodes…"
                  className="w-full text-sm font-medium px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:outline-none focus:border-haven-navy transition-all resize-none"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-haven-navy hover:bg-slate-900 text-white font-extrabold rounded-2xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                {isSubmitting ? "Envoi en cours…" : "Envoyer ma demande"}
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};
