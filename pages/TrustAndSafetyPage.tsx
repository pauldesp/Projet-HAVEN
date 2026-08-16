import React from 'react';
import { ShieldCheck, Eye, Key, Users2, Lock, Sparkles, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TrustAndSafetyPage: React.FC = () => {
  const navigate = useNavigate();

  const safetyPillars = [
    {
      icon: Key,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      title: "Identités 100% Vérifiées",
      desc: "Tous les locataires et propriétaires doivent justifier d'une pièce d'identité officielle en cours de validité. Les profils incompressibles évitent les pseudonymes frauduleux."
    },
    {
      icon: Lock,
      iconColor: 'text-indigo-650',
      bgColor: 'bg-indigo-50',
      title: "Paiements Sécurisés (Stripe)",
      desc: "L'ensemble des transferts de loyers, dépôts de garantie ainsi que les frais d'opération transitent par Stripe avec le protocole 3D Secure, garantissant un cloisonnement des fonds."
    },
    {
      icon: Eye,
      iconColor: 'text-emerald-650',
      bgColor: 'bg-emerald-50',
      title: "Annonces Contrôlées",
      desc: "Chaque annonce publiée fait l'objet d'un examen rigoureux par notre équipe de modération. Nous vérifions le respect scrupuleux du cahier des charges de décence et de confort."
    },
    {
      icon: Users2,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      title: "Charte de vie communautaire",
      desc: "En colocation, le bien vivre-ensemble est essentiel. Notre charte d'engagement mutuel définit des règles élémentaires de discrétion, de respect du calme et de propreté."
    }
  ];

  return (
    <div className="bg-haven-cream min-h-screen py-16 px-4 sm:px-6 lg:px-8 mt-12 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">
            Confiance & Sécurité
          </span>
          <h1 className="text-4xl sm:text-5xl font-heading font-black text-haven-navy mt-4 mb-6 leading-tight">
            Créer un cadre de vie fiable<br />pour chaque colocataire
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            La confiance mutuelle est le moteur de HAVEN. Nous mettons en œuvre les protocoles de vérification les plus stricts pour vous garantir sérénité et confort.
          </p>
        </div>

        {/* Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {safetyPillars.map((pillar, idx) => {
            const IconComponent = pillar.icon;
            return (
              <div key={idx} className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-premium flex flex-col items-start gap-4">
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
        <div className="bg-white rounded-[2.5rem] p-8 sm:p-12 border border-gray-100 shadow-premium mb-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 translate-x-20">
            <ShieldCheck size={200} />
          </div>
          <div className="max-w-2xl mx-auto text-center space-y-6 relative z-10">
            <h3 className="font-heading font-black text-2xl text-haven-navy">
              Médiation & Signalements Réactifs
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              En cas de comportement inapproprié, de dégradation ou de non-respect manifeste du cahier des charges contractuel, locataires et propriétaires disposent d'un outil de signalement dédié directement accessible depuis l'historique ou le backoffice. Nos modérateurs analysent chaque demande sous 24h ouvrées et appliquent des sanctions pouvant aller jusqu'à l'expulsion de la plateforme et l'annulation des réservations.
            </p>
            <div className="pt-4">
              <button
                onClick={() => navigate('/contact')}
                className="inline-flex items-center gap-2 bg-haven-navy text-white font-extrabold px-6 py-3.5 rounded-xl hover:bg-slate-900 transition-all text-xs uppercase tracking-wider"
              >
                <span>Contacter l'équipe de sécurité</span>
              </button>
            </div>
          </div>
        </div>

        {/* Community promise */}
        <div className="bg-gradient-to-tr from-haven-navy to-slate-900 rounded-[2.5rem] p-10 text-white shadow-premium">
          <div className="max-w-xl mx-auto text-center space-y-5">
            <Sparkles className="text-haven-red mx-auto" size={32} />
            <h4 className="font-heading font-bold text-xl">Notre promesse d'excellence</h4>
            <p className="text-xs text-gray-300 leading-relaxed font-medium">
              Nous croyons en une colocation flexible et moderne. Pour chaque compte inscrit, nous garantissons l'équité des droits, le cryptage intégral des documents d'identité archivés, et un soutien inestimable à l'insertion des jeunes actifs et étudiants.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
