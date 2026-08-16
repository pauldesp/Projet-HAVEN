import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, TrendingUp, Handshake, ShieldAlert, BadgeCent, ChevronRight, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const BecomeOwner: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const advantages = [
    {
      icon: TrendingUp,
      color: 'text-emerald-650',
      bgColor: 'bg-emerald-50',
      title: "Rendement financier optimisé (+30%)",
      desc: "La location à la chambre en courte durée permet d'augmenter significativement vos revenus locatifs par rapport à un bail classique de colocation nue ou d'un appartement meublé individuel."
    },
    {
      icon: ShieldCheck,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      title: "Sécurité juridique maximale",
      desc: "Nos baux numériques individuels, validés par notre équipe juridique, sont combinés avec un état des lieux (check-in / check-out) numérique et infalsifiable qui fait foi en matière d'état du logement."
    },
    {
      icon: Handshake,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      title: "Gestion autonome et simplifiée",
      desc: "Oubliez les allers-retours fastidieux pour les remises de clés. Nos outils de messagerie intégrée et de check-in autonome sur mobile réduisent votre temps de gestion à zéro."
    }
  ];

  const requirements = [
    "Un logement meublé décent conforme aux critères de surface légaux (min. 9m² par chambre)",
    "Équipements de cuisine haut-de-gamme (four, plaques de cuisson, réfrigérateur de grande capacité)",
    "Une connexion Internet Wi-Fi haut débit incluse dans le montant des charges globales",
    "Garantie d'accès autonome pour les colocataires (serrure connectée ou boîte à clés sécurisée)",
    "Accord de respect du cahier des charges d'entretien et de confort HAVEN"
  ];

  const handleStartPublishing = () => {
    if (!currentUser) {
      navigate('/login?redirect=/owner/publish&role=OWNER');
    } else {
      navigate('/owner/publish');
    }
  };

  return (
    <div className="bg-haven-cream min-h-screen py-16 px-4 sm:px-6 lg:px-8 mt-12 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        {/* Top Header */}
        <div className="text-center mb-16">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">
            ESPACE PROPRIÉTAIRE LOGEMENTS
          </span>
          <h1 className="text-4xl sm:text-5xl font-heading font-black text-haven-navy mt-4 mb-6 leading-tight">
            Rentabilisez et protégez vos<br />investissements en colocation
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Rejoignez des centaines de bailleurs particuliers qui louent leurs chambres meublées en courte durée grâce à l'assurance de notre technologie autonome.
          </p>
        </div>

        {/* Traditional vs HAVEN Comparison Card */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-premium p-8 sm:p-12 mb-16 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl"></div>
          
          <h3 className="font-heading font-black text-2xl text-haven-navy mb-8 text-center sm:text-left">
            La colocation réinventée par HAVEN
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Traditional */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-widest text-[#B24E31]">
                <ShieldAlert size={16} />
                <span>Colocation classique</span>
              </div>
              <ul className="space-y-3.5 text-sm text-gray-500">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mr-1 shrink-0">✕</span>
                  <span>Solidarité des loyers compliquée pour les parents garants</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mr-1 shrink-0">✕</span>
                  <span>États des lieux papier imprécis menant à des litiges répétés</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mr-1 shrink-0">✕</span>
                  <span>Chambres vacantes pendant les périodes scolaires creuses</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mr-1 shrink-0">✕</span>
                  <span>Gestion fastidieuse des entrées/sorties de locataires</span>
                </li>
              </ul>
            </div>

            {/* HAVEN */}
            <div className="space-y-4 border-t md:border-t-0 md:border-l border-gray-100 pt-8 md:pt-0 md:pl-10">
              <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-widest text-emerald-650">
                <CheckCircle2 size={16} />
                <span>Plateforme HAVEN</span>
              </div>
              <ul className="space-y-3.5 text-sm text-gray-600 font-medium">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-extrabold mr-1 shrink-0">✓</span>
                  <span>Baux individuels flexibles sans solidarité de loyer</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-extrabold mr-1 shrink-0">✓</span>
                  <span>États des lieux numériques intégrés (impossible d'esquiver)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-extrabold mr-1 shrink-0">✓</span>
                  <span>Réservations de courte durée comblant toute l'année</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-extrabold mr-1 shrink-0">✓</span>
                  <span>Encaissement automatisé et sécurisé Stripe en 24h</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Core Advantages List */}
        <div className="space-y-8 mb-16">
          <h3 className="font-heading font-bold text-2xl text-haven-navy text-center mb-10">
            Trois piliers conçus pour votre sérénité
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {advantages.map((adv, idx) => {
              const IconComp = adv.icon;
              return (
                <div key={idx} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-card flex flex-col justify-start">
                  <div className={`w-12 h-12 rounded-2xl ${adv.bgColor} ${adv.color} flex items-center justify-center mb-6`}>
                    <IconComp size={22} />
                  </div>
                  <h4 className="text-base font-bold text-haven-navy mb-2 leading-tight">
                    {adv.title}
                  </h4>
                  <p className="text-xs text-gray-400 leading-relaxed font-semibold">
                    {adv.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Specifications & Charter Specifications (Cahier des charges) */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-premium p-8 sm:p-12 mb-16">
          <div className="max-w-2xl mx-auto">
            <h3 className="font-heading font-black text-2xl text-haven-navy mb-4 text-center">
              Le Cahier des Charges HAVEN d'Excellence
            </h3>
            <p className="text-sm text-gray-500 text-center mb-8">
              Pour assurer l'harmonie en colocation et un service de standing hôtelier professionnel, chaque logement répertorié sur HAVEN s'engage à respecter les obligations suivantes :
            </p>

            <ul className="space-y-4">
              {requirements.map((req, idx) => (
                <li key={idx} className="flex gap-4 items-start text-sm text-gray-600">
                  <div className="w-5 h-5 rounded-full bg-haven-red/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={12} className="text-haven-red" />
                  </div>
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Call To Action Box */}
        <div className="bg-gray-950 rounded-[2.5rem] p-10 sm:p-12 text-white shadow-premium text-center">
          <h3 className="font-heading font-bold text-2xl sm:text-3xl mb-4">
            Mettez votre bien en ligne dès aujourd'hui
          </h3>
          <p className="text-sm text-gray-300 max-w-xl mx-auto mb-8 font-semibold">
            Rejoignez notre réseau de propriétaires validés. Créez votre compte bailleur, téléversez vos baux et laissez l'application gérer vos réservations en toute autonomie.
          </p>

          <button
            onClick={handleStartPublishing}
            className="px-8 py-4 bg-haven-red text-white font-extrabold rounded-2xl hover:bg-red-700 transition-all shadow-lg inline-flex items-center gap-2"
          >
            <span>Démarrer la publication</span>
            <ChevronRight size={18} />
          </button>
        </div>

      </div>
    </div>
  );
};
