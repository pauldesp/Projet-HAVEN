import React, { useState } from 'react';
import { Building2, GraduationCap, ArrowRight, ShieldCheck, Hotel, Sparkles, Check, Mail, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast.error("Veuillez remplir les champs obligatoires (Nom, Email, Message)");
      return;
    }
    
    setIsSubmitting(true);
    // Simulate API registration
    setTimeout(() => {
      toast.success("Demande envoyée avec succès !", {
        description: "Un conseiller partenariats prendra contact avec vous sous 24 heures ouvrées.",
        duration: 5000
      });
      setFormData({
        name: '',
        organization: '',
        orgType: 'SCHOOL',
        email: '',
        phone: '',
        message: ''
      });
      setIsSubmitting(false);
    }, 1200);
  };

  return (
    <div className="bg-haven-cream min-h-screen py-16 px-4 sm:px-6 lg:px-8 mt-12 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        {/* Hero Banner */}
        <div className="text-center mb-16">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">
            Partenaires Établissements & RH
          </span>
          <h1 className="text-4xl sm:text-5xl font-heading font-black text-haven-navy mt-4 mb-6 leading-tight">
            Simplifiez le logement de vos<br />étudiants et collaborateurs
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            HAVEN s'associe avec les universités, les grandes écoles et les entreprises partenaires pour offrir des solutions de colocation clés en main, flexibles et sécurisées.
          </p>
        </div>

        {/* Benefits Grid for School vs Enterprise */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Schools */}
          <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 border border-gray-100 shadow-premium flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                <GraduationCap size={24} />
              </div>
              <h2 className="text-2xl font-heading font-black text-haven-navy mb-4">
                Écoles & Universités
              </h2>
              <p className="text-gray-550 text-sm leading-relaxed mb-6">
                Facilitez la rentrée et le cursus de vos étudiants français et internationaux en leur réservant des logements certifiés et conformes à notre strict cahier des charges de colocation.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Accès prioritaire à notre catalogue de colocations équipées",
                  "Étudiants internationaux acceptés sans garant locatif physique",
                  "Garantie d'état des lieux numérique fluide à l'entrée et à la sortie",
                  "Espace de communication d'école personnalisé"
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
              <p className="text-xs text-gray-400 mt-1 font-medium">Bureaux des Élèves, Directions des Relations Internationales, Services Logements</p>
            </div>
          </div>

          {/* Companies */}
          <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 border border-gray-100 shadow-premium flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 bg-haven-red/5 text-haven-red rounded-2xl flex items-center justify-center mb-6">
                <Building2 size={24} />
              </div>
              <h2 className="text-2xl font-heading font-black text-haven-navy mb-4">
                Entreprises & Recruteurs
              </h2>
              <p className="text-gray-550 text-sm leading-relaxed mb-6">
                Accompagnez la mobilité de vos stagiaires, alternants ou collaborateurs en période d'essai ou mission temporaire longue durée. Offrez-leur un cadre de vie de premier plan.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Logements entièrement meublés prêt-à-vivre, Internet inclus",
                  "Gestion d'inventaire et états des lieux numériques transparents",
                  "Facturation mensuelle centralisée ou prise en charge directe par l'entreprise",
                  "Durée flexible adaptée parfaitement aux périodes de stage ou d'alternance"
                ].map((item, idx) => (
                  <li key={idx} className="flex gap-2 text-xs font-bold text-gray-650 items-start">
                    <Check size={14} className="text-haven-red shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-gray-55 pt-6 mt-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-haven-red">Pour les DRH & Mobilité</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">Responsables Talent Acquisition, Services d'Onboarding, Gestionnaires de Mobilité Internationale</p>
            </div>
          </div>
        </div>

        {/* Feature stats */}
        <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-premium mb-16">
          <h3 className="font-heading font-bold text-center text-xl text-haven-navy mb-8">
            Pourquoi HAVEN est la solution de confiance partenaires ?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            <div className="pt-4 sm:pt-0 sm:px-4 space-y-2">
              <div className="text-3xl font-heading font-black text-haven-navy">98%</div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">Satisfaction Locataires</p>
              <p className="text-xs text-gray-400 leading-relaxed">De jeunes professionnels et étudiants enchantés par leur accueil et l'autonomie</p>
            </div>
            <div className="pt-8 sm:pt-0 sm:px-4 space-y-2">
              <div className="text-3xl font-heading font-black text-haven-navy">100%</div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">États des lieux validés</p>
              <p className="text-xs text-gray-400 leading-relaxed">Une signature numérique sécurisée qui supprime tout contentieux à l'entrée ou sortie</p>
            </div>
            <div className="pt-8 sm:pt-0 sm:px-4 space-y-2">
              <div className="text-3xl font-heading font-black text-haven-navy">&lt; 24h</div>
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">Délai moyen d'onboarding</p>
              <p className="text-xs text-gray-400 leading-relaxed">Une contractualisation digitale et une validation de réservation ultra-rapide</p>
            </div>
          </div>
        </div>

        {/* Form panel & contact details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Details info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-haven-navy rounded-[2.5rem] p-8 text-white shadow-premium space-y-6">
              <h3 className="font-heading font-bold text-2xl">Contact Direct</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                Notre bureau des relations partenaires est à votre disposition pour imaginer ensemble la formule la plus adaptée à votre structure : allocations de chambres, baux collectifs ou codes de réduction de fidélité pour vos étudiants/collaborateurs.
              </p>
              <div className="space-y-4 pt-4 border-t border-white/10 text-xs">
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-haven-red" />
                  <span>partenariats@haven-coloc.com</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-haven-red" />
                  <span>+33 1 74 39 82 05</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={16} className="text-haven-red" />
                  <span>75008 Paris, France</span>
                </div>
              </div>
            </div>
          </div>

          {/* Partner register form */}
          <div className="lg:col-span-7 bg-white rounded-[2.5rem] p-8 sm:p-10 border border-gray-100 shadow-premium">
            <h3 className="font-heading font-bold text-2xl text-haven-navy mb-2">Devenir Établissement Partenaire</h3>
            <p className="text-xs text-gray-400 mb-6 font-medium">Exprimez vos besoins de logement de courte durée et nos équipes vous contacteront rapidement.</p>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Votre Nom Complet *</label>
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Email professionnel *</label>
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
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Numéro de téléphone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+33 6 12 34 56 78"
                  className="w-full text-sm font-medium px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:outline-none focus:border-haven-navy transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Message & description du besoin *</label>
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
                {isSubmitting ? "Envoi en cours..." : "Soumettre la candidature partenaire"}
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};
