import React from 'react';
import { ShieldCheck, Eye, Key, Users2, Lock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TrustAndSafetyPage: React.FC = () => {
  const navigate = useNavigate();

  const safetyPillars = [
    {
      icon: Key,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      title: "Des membres vérifiés",
      desc: "Avant de réserver ou de publier, chaque membre transmet une pièce d’identité et un justificatif de domicile, examinés un par un par l’équipe Haven. Un compte non vérifié ne peut ni réserver ni publier."
    },
    {
      icon: Lock,
      iconColor: 'text-indigo-650',
      bgColor: 'bg-indigo-50',
      title: "Des paiements protégés",
      desc: "Les paiements passent par Stripe, avec l’authentification 3D Secure demandée par votre banque. Haven ne voit jamais votre numéro de carte et ne verse le propriétaire qu’après votre arrivée."
    },
    {
      icon: Eye,
      iconColor: 'text-emerald-650',
      bgColor: 'bg-emerald-50',
      title: "Des annonces contrôlées",
      desc: "Chaque annonce est examinée par l’équipe Haven avant sa mise en ligne, puis à nouveau dès que ses textes, ses photos ou son adresse changent, au regard du cahier des charges du logement."
    },
    {
      icon: Users2,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      title: "Des règles de vie communes",
      desc: "Respect des colocataires et du voisinage, calme, propreté des parties communes : ces règles sont rappelées à chaque réservation, avec les règles propres à chaque logement."
    }
  ];

  return (
    <div className="bg-haven-cream min-h-screen py-8 sm:py-16 px-4 sm:px-6 lg:px-8 mt-4 sm:mt-12 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-16">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">
            Confiance et sécurité
          </span>
          <h1 className="text-[1.75rem] sm:text-5xl font-heading font-black text-haven-navy mt-3 sm:mt-4 mb-3 sm:mb-6 leading-tight">
            Une colocation de confiance, <br className="hidden sm:inline" />pour chacun
          </h1>
          <p className="text-sm sm:text-lg text-gray-500 max-w-2xl mx-auto">
            Membres vérifiés, annonces contrôlées, paiements protégés et preuves à chaque séjour : voici ce que fait Haven pour que chacun vive sa colocation sereinement.
          </p>
        </div>

        {/* Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 mb-8 sm:mb-16">
          {safetyPillars.map((pillar, idx) => {
            const IconComponent = pillar.icon;
            return (
              <div key={idx} className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-8 border border-gray-100 shadow-premium flex flex-col items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl ${pillar.bgColor} ${pillar.iconColor} flex items-center justify-center shrink-0`}>
                  <IconComponent size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-heading font-black text-haven-navy mb-2">
                    {pillar.title}
                  </h3>
                  <p className="text-xs text-gray-400 font-semibold leading-relaxed">
                    {pillar.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Moderation Block */}
        <div className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-12 border border-gray-100 shadow-premium mb-8 sm:mb-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 translate-x-20">
            <ShieldCheck size={200} />
          </div>
          <div className="max-w-2xl mx-auto text-center space-y-6 relative z-10">
            <h3 className="font-heading font-black text-xl sm:text-2xl text-haven-navy">
              Signalements et médiation
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Un problème pendant le séjour, un comportement inapproprié ou une annonce trompeuse ? Signalez-le depuis « Mes séjours » ou avec le bouton « Signaler ». Le propriétaire est prévenu ; si la situation n’est pas résolue, l’équipe Haven intervient, peut suspendre un versement, rembourser le locataire, suspendre une annonce ou un compte.
            </p>
            <div className="pt-4">
              <button
                onClick={() => navigate('/contact')}
                className="inline-flex items-center gap-2 bg-haven-navy text-white font-extrabold px-6 py-3.5 rounded-xl hover:bg-slate-900 transition-all text-xs uppercase tracking-wider"
              >
                <span>Contacter l’équipe Haven</span>
              </button>
            </div>
          </div>
        </div>

        {/* Community promise */}
        <div className="bg-gradient-to-tr from-haven-navy to-slate-900 rounded-[1.75rem] sm:rounded-[2.5rem] p-6 sm:p-10 text-white shadow-premium">
          <div className="max-w-xl mx-auto text-center space-y-5">
            <Sparkles className="text-haven-red mx-auto" size={32} />
            <h4 className="font-heading font-bold text-xl">Vos données sont protégées</h4>
            <p className="text-xs text-gray-300 leading-relaxed font-medium">
              Vos justificatifs ne sont visibles que par vous et l’équipe Haven, et ne figurent jamais sur votre profil public. Haven ne vend aucune donnée. Vous pouvez télécharger vos données ou supprimer votre compte à tout moment depuis « Mon compte ».
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
