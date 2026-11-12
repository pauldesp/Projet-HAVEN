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
        {/* Hero Banner */}
        <div className="text-center mb-8 sm:mb-16">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">
            Écoles et entreprises
          </span>
          <h1 className="text-[1.75rem] sm:text-5xl font-heading font-black text-haven-navy mt-3 sm:mt-4 mb-3 sm:mb-6 leading-tight">
            Simplifiez le logement de vos <br className="hidden sm:inline" />étudiants et collaborateurs
          </h1>
          <p className="text-sm sm:text-lg text-gray-500 max-w-2xl mx-auto">
            Stages, alternances, échanges, missions : Haven aide vos étudiants et collaborateurs à trouver une chambre vérifiée pour la durée exacte de leur séjour.
          </p>
        </div>

        {/* Benefits Grid for School vs Enterprise */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 mb-8 sm:mb-16">
          {/* Schools */}
          <div className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-10 border border-gray-100 shadow-premium flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                <GraduationCap size={24} />
              </div>
              <h2 className="text-xl sm:text-2xl font-heading font-black text-haven-navy mb-4">
                Écoles et universités
              </h2>
              <p className="text-gray-550 text-sm leading-relaxed mb-6">
                Orientez vos étudiants, français ou internationaux, vers des chambres en colocation vérifiées, réservables pour un semestre, un stage ou des périodes en alternance.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Des chambres meublées dans des colocations vérifiées",
                  "Pas de garant demandé : chaque séjour est payé à la réservation",
                  "États des lieux avec photos à l’entrée et à la sortie",
                  "Réservation de plusieurs périodes en une fois pour les alternants"
                ].map((item, idx) => (
                  <li key={idx} className="flex gap-2 text-xs font-bold text-gray-650 items-start">
                    <Check size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-gray-55 pt-6 mt-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Recommandé pour</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">Bureaux des élèves, relations internationales, services logement</p>
            </div>
          </div>

          {/* Companies */}
          <div className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-10 border border-gray-100 shadow-premium flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-haven-red/5 text-haven-red rounded-2xl flex items-center justify-center mb-6">
                <Building2 size={24} />
              </div>
              <h2 className="text-xl sm:text-2xl font-heading font-black text-haven-navy mb-4">
                Entreprises et recruteurs
              </h2>
              <p className="text-gray-550 text-sm leading-relaxed mb-6">
                Facilitez l’arrivée de vos stagiaires, alternants et collaborateurs en mission : une chambre meublée, prête à vivre, pour la durée exacte de leur présence.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Des chambres meublées et prêtes à vivre, au prix tout compris",
                  "États des lieux avec photos et suivi des incidents par Haven",
                  "Un justificatif de paiement pour chaque séjour",
                  "Une durée adaptée aux périodes de stage, d’alternance ou de mission"
                ].map((item, idx) => (
                  <li key={idx} className="flex gap-2 text-xs font-bold text-gray-650 items-start">
                    <Check size={14} className="text-haven-red shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-gray-55 pt-6 mt-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-haven-red">Pour les RH et la mobilité</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">Recrutement, intégration, mobilité internationale</p>
            </div>
          </div>
        </div>

        {/* What Haven offers partners (facts only). */}
        <div className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] p-6 sm:p-10 border border-gray-100 shadow-premium mb-8 sm:mb-16">
          <h3 className="font-heading font-bold text-center text-xl text-haven-navy mb-8">
            Ce que Haven apporte à vos étudiants et collaborateurs
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8 text-center divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {[
              ['Des logements vérifiés', 'Chaque annonce est contrôlée par Haven avant sa mise en ligne, au regard d’un cahier des charges commun.'],
              ['Des séjours à la carte', 'De quelques nuits à plusieurs mois, ou plusieurs périodes dans l’année avec la réservation récurrente.'],
              ['Des preuves à chaque séjour', 'États des lieux d’entrée et de sortie avec photos, et suivi des incidents par l’équipe Haven.'],
            ].map(([title, text], index) => <div key={title} className={`${index ? 'pt-8' : 'pt-4'} sm:pt-0 sm:px-4 space-y-2`}>
              <p className="font-heading text-lg font-black text-haven-navy">{title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{text}</p>
            </div>)}
          </div>
        </div>

        {/* Form panel & contact details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-start">
          {/* Details info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-haven-navy rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-8 text-white shadow-premium space-y-6">
              <h3 className="font-heading font-bold text-xl sm:text-2xl">Parlons-en</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                Présentez-nous vos besoins (nombre de personnes, villes, périodes) : nous étudierons ensemble la meilleure façon d’accompagner vos étudiants ou collaborateurs.
              </p>
              <p className="pt-4 border-t border-white/10 text-xs text-gray-300">Remplissez le formulaire : votre demande arrive directement à l’équipe Haven, qui vous répond par e-mail.</p>
            </div>
          </div>

          {/* Partner register form */}
          <div className="lg:col-span-7 bg-white rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-10 border border-gray-100 shadow-premium">
            <h3 className="font-heading font-bold text-xl sm:text-2xl text-haven-navy mb-2">Nous contacter</h3>
            <p className="text-xs text-gray-400 mb-6 font-medium">Décrivez vos besoins : l’équipe Haven vous répondra par e-mail.</p>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Votre nom complet *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Marc Lebrun"
                    className="w-full text-sm font-medium px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:outline-none focus:border-haven-navy transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Établissement / Organisme</label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={e => setFormData(p => ({ ...p, organization: e.target.value }))}
                    placeholder="Université XYZ / Entreprise ABC"
                    className="w-full text-sm font-medium px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:outline-none focus:border-haven-navy transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nature de l'entité</label>
                  <select
                    value={formData.orgType}
                    onChange={e => setFormData(p => ({ ...p, orgType: e.target.value }))}
                    className="w-full text-sm font-bold px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:outline-none focus:border-haven-navy transition-all"
                  >
                    <option value="SCHOOL">Université / Grande École</option>
                    <option value="COMPANY">Entreprise / Cabinet RH</option>
                    <option value="ASSOCIATION">Association étudiante / Autre</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">E-mail professionnel *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    placeholder="m.lebrun@univ-paris.fr"
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
                  placeholder="Expliquez brièvement le type d'accord recherché, le nombre de chambres estimé pour vos collaborateurs/étudiants..."
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
