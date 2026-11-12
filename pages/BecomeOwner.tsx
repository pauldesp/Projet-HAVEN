import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, TrendingUp, Handshake, ShieldAlert, ChevronRight, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const BecomeOwner: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const advantages = [
    {
      icon: TrendingUp,
      color: 'text-emerald-650',
      bgColor: 'bg-emerald-50',
      title: "Des chambres occupées plus souvent",
      desc: "Stagiaires, alternants, étudiants en mobilité et jeunes actifs réservent quelques semaines ou plusieurs périodes dans l’année grâce à la réservation récurrente. Les séjours courts entre deux locations remplissent aussi les intervalles libres."
    },
    {
      icon: ShieldCheck,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      title: "Des locataires vérifiés, des preuves claires",
      desc: "Chaque locataire fait vérifier son identité et son domicile avant de réserver. Les états des lieux d’entrée et de sortie, avec photos, sont réalisés à chaque séjour et conservés dans votre espace."
    },
    {
      icon: Handshake,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      title: "Une gestion simplifiée",
      desc: "Réservation instantanée, paiement encaissé par Haven, consignes d’accès envoyées automatiquement 72 heures avant l’arrivée, messagerie et suivi des incidents : vous gérez tout depuis votre tableau de bord."
    }
  ];

  const requirements = [
    "Un logement décent, propre et en bon état, adapté à la vie à plusieurs",
    "Des chambres meublées : lit et literie, rangement, bureau, éclairage et occultation",
    "Une cuisine équipée (réfrigérateur, plaques, vaisselle) et des parties communes fonctionnelles",
    "Un ménage des parties communes au moins une fois par semaine pendant les séjours",
    "Des disponibilités et des consignes d’accès toujours à jour, et une réponse rapide aux signalements"
  ];

  const handleStartPublishing = () => {
    if (!currentUser) {
      navigate('/login?redirect=/owner/publish&role=OWNER');
    } else {
      navigate('/owner/publish');
    }
  };

  return (
    <div className="bg-haven-cream min-h-screen py-8 sm:py-16 px-4 sm:px-6 lg:px-8 mt-4 sm:mt-12 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        {/* Top Header */}
        <div className="text-center mb-8 sm:mb-16">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">
            Propriétaires
          </span>
          <h1 className="text-[1.75rem] sm:text-5xl font-heading font-black text-haven-navy mt-3 sm:mt-4 mb-3 sm:mb-6 leading-tight">
            Louez vos chambres meublées <br className="hidden sm:inline" />en toute sérénité
          </h1>
          <p className="text-sm sm:text-lg text-gray-500 max-w-2xl mx-auto">
            Proposez vos chambres à des locataires vérifiés, pour quelques semaines ou plusieurs mois. Publication gratuite, aucune commission sur vos revenus.
          </p>
        </div>

        {/* Traditional vs HAVEN Comparison Card */}
        <div className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] border border-gray-100 shadow-premium p-5 sm:p-12 mb-8 sm:mb-16 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl"></div>
          
          <h3 className="font-heading font-black text-xl sm:text-2xl text-haven-navy mb-8 text-center sm:text-left">
            Ce que Haven change pour vous
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
            {/* Traditional */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-widest text-[#B24E31]">
                <ShieldAlert size={16} />
                <span>Colocation classique</span>
              </div>
              <ul className="space-y-3.5 text-sm text-gray-500">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mr-1 shrink-0">✕</span>
                  <span>Un seul bail pour tous, des garants à vérifier</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mr-1 shrink-0">✕</span>
                  <span>Des états des lieux papier, sources de désaccords</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mr-1 shrink-0">✕</span>
                  <span>Des chambres vides entre deux locataires</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-extrabold mr-1 shrink-0">✕</span>
                  <span>Des remises de clés et des relances de paiement</span>
                </li>
              </ul>
            </div>

            {/* HAVEN */}
            <div className="space-y-4 border-t md:border-t-0 md:border-l border-gray-100 pt-8 md:pt-0 md:pl-10">
              <div className="flex items-center gap-2.5 text-xs font-black uppercase tracking-widest text-emerald-650">
                <CheckCircle2 size={16} />
                <span>Avec Haven</span>
              </div>
              <ul className="space-y-3.5 text-sm text-gray-600 font-medium">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-extrabold mr-1 shrink-0">✓</span>
                  <span>Une réservation par chambre et par locataire</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-extrabold mr-1 shrink-0">✓</span>
                  <span>États des lieux avec photos à chaque entrée et sortie</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-extrabold mr-1 shrink-0">✓</span>
                  <span>Séjours courts et réservations récurrentes toute l’année</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600 font-extrabold mr-1 shrink-0">✓</span>
                  <span>Paiement encaissé par Haven, versé après chaque arrivée</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Core Advantages List */}
        <div className="space-y-8 mb-8 sm:mb-16">
          <h3 className="font-heading font-bold text-xl sm:text-2xl text-haven-navy text-center mb-6 sm:mb-10">
            Trois piliers conçus pour votre sérénité
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {advantages.map((adv, idx) => {
              const IconComp = adv.icon;
              return (
                <div key={idx} className="bg-white p-5 sm:p-8 rounded-3xl border border-gray-100 shadow-card flex flex-col justify-start">
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
        <div className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] border border-gray-100 shadow-premium p-5 sm:p-12 mb-8 sm:mb-16">
          <div className="max-w-2xl mx-auto">
            <h3 className="font-heading font-black text-xl sm:text-2xl text-haven-navy mb-4 text-center">
              Le cahier des charges Haven
            </h3>
            <p className="text-sm text-gray-500 text-center mb-8">
              Pour garantir aux locataires une qualité constante, chaque propriétaire s’engage notamment à proposer :
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
        <div className="bg-gray-950 rounded-[1.75rem] sm:rounded-[2.5rem] p-6 sm:p-12 text-white shadow-premium text-center">
          <h3 className="font-heading font-bold text-2xl sm:text-3xl mb-4">
            Publiez votre annonce gratuitement
          </h3>
          <p className="text-sm text-gray-300 max-w-xl mx-auto mb-8 font-semibold">
            Créez votre compte, faites-le vérifier, configurez vos versements avec Stripe, puis décrivez votre logement. Haven vérifie votre annonce avant sa mise en ligne.
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
