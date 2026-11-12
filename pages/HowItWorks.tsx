import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, ShieldCheck, CreditCard, Sparkles, Home, FileText, Key, CheckCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const HowItWorks: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'TENANT' | 'OWNER'>('TENANT');
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const tenantSteps = [
    {
      icon: Search,
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      title: "1. Trouvez votre chambre",
      desc: "Recherchez par ville et par dates, pour un séjour unique ou pour plusieurs périodes réparties dans l’année. Chaque logement est vérifié par Haven, et sa fiche montre les colocataires déjà présents à vos dates."
    },
    {
      icon: Calendar,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      title: "2. Faites vérifier votre compte, puis réservez",
      desc: "Transmettez une fois votre pièce d’identité et un justificatif de domicile. Une fois votre compte vérifié, la réservation est instantanée : de quelques nuits à plusieurs mois, ou en série grâce à la réservation récurrente."
    },
    {
      icon: CreditCard,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      title: "3. Payez en toute sécurité",
      desc: "Le prix affiché comprend tout : nuits, ménage et frais de service. Vous payez par carte sur la page sécurisée de Stripe, et Haven ne verse le propriétaire qu’après votre arrivée."
    },
    {
      icon: ShieldCheck,
      iconColor: 'text-teal-600',
      bgColor: 'bg-teal-50',
      title: "4. Emménagez en autonomie",
      desc: "Vos consignes d’accès arrivent 72 heures avant le séjour. Le jour J, vous réalisez l’état des lieux d’entrée en quelques photos depuis votre téléphone : il fait foi en cas de désaccord."
    }
  ];

  const ownerSteps = [
    {
      icon: Home,
      iconColor: 'text-haven-red',
      bgColor: 'bg-haven-red/5',
      title: "1. Publiez votre annonce gratuitement",
      desc: "Décrivez votre logement et chacune de ses chambres, ajoutez vos photos, fixez le prix par nuit, le forfait ménage et le nombre minimum de nuits. Haven vérifie l’annonce avant sa mise en ligne."
    },
    {
      icon: FileText,
      iconColor: 'text-violet-600',
      bgColor: 'bg-violet-50',
      title: "2. Respectez le cahier des charges Haven",
      desc: "Logement propre et en bon état, chambres meublées, cuisine équipée, ménage des parties communes chaque semaine : ces engagements garantissent aux locataires une qualité constante."
    },
    {
      icon: ShieldCheck,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      title: "3. Laissez les séjours se dérouler",
      desc: "Les locataires vérifiés réservent directement vos dates libres. Haven leur transmet vos consignes d’accès, et les états des lieux d’entrée et de sortie, avec photos, arrivent dans votre espace."
    },
    {
      icon: Key,
      iconColor: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      title: "4. Recevez vos revenus après chaque arrivée",
      desc: "Vous recevez l’intégralité du prix des nuits et du ménage, sans commission : les frais de service sont payés par le locataire. Le versement part automatiquement vers votre compte bancaire après l’arrivée du locataire."
    }
  ];

  const handleStart = () => {
    if (activeTab === 'TENANT') {
      navigate('/search');
    } else {
      if (!currentUser) {
        navigate('/login?redirect=/owner/publish&role=OWNER');
      } else {
        navigate('/owner/publish');
      }
    }
  };

  return (
    <div className="bg-haven-cream min-h-screen py-8 sm:py-16 px-4 sm:px-6 lg:px-8 mt-4 sm:mt-12 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-16">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">
            Guide d'utilisation
          </span>
          <h1 className="text-[1.75rem] sm:text-5xl font-heading font-black text-haven-navy mt-3 sm:mt-4 mb-3 sm:mb-6 leading-tight">
            Une colocation simple, <br className="hidden sm:inline" />flexible et vérifiée
          </h1>
          <p className="text-sm sm:text-lg text-gray-500 max-w-2xl mx-auto">
            De la recherche jusqu’à l’état des lieux de sortie, voici comment se déroule un séjour sur Haven, côté locataire comme côté propriétaire.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex p-1.5 bg-gray-100 rounded-2xl max-w-md mx-auto mb-8 sm:mb-16 shadow-inner">
          <button
            onClick={() => setActiveTab('TENANT')}
            className={`flex-1 py-3 px-6 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'TENANT'
                ? 'bg-white text-haven-navy shadow-sm font-black'
                : 'text-gray-500 hover:text-haven-navy'
            }`}
          >
            <Sparkles size={16} />
            Je suis locataire
          </button>
          <button
            onClick={() => setActiveTab('OWNER')}
            className={`flex-1 py-3 px-6 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'OWNER'
                ? 'bg-white text-haven-navy shadow-sm font-black'
                : 'text-gray-500 hover:text-haven-navy'
            }`}
          >
            <Home size={16} />
            Je suis propriétaire
          </button>
        </div>

        {/* Dynamic Workflow Steps */}
        <div className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-12 border border-gray-100 shadow-premium mb-6 sm:mb-12">
          <div className="space-y-12">
            {(activeTab === 'TENANT' ? tenantSteps : ownerSteps).map((step, index) => {
              const IconComponent = step.icon;
              return (
                <div key={index} className="flex flex-col md:flex-row gap-6 md:gap-8 items-start group">
                  <div className={`w-14 h-14 shrink-0 ${step.bgColor} rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-sm`}>
                    <IconComponent className={`${step.iconColor}`} size={26} />
                  </div>
                  <div>
                    <h3 className="text-xl font-heading font-black text-haven-navy mb-2">
                      {step.title}
                    </h3>
                    <p className="text-gray-500 text-sm sm:text-base leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Call to action card */}
        <div className="bg-gradient-to-tr from-haven-navy to-slate-900 rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-12 text-white shadow-premium text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 translate-x-20">
            <CheckCircle size={300} />
          </div>
          <div className="relative z-10 max-w-xl mx-auto space-y-6">
            <h3 className="font-heading font-bold text-2xl sm:text-3xl leading-tight">
              {activeTab === 'TENANT' 
                ? "Prêt à trouver votre coloc pour vos études ou votre stage ?" 
                : "Commencez à louer vos chambres de manière simplifiée !"}
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              {activeTab === 'TENANT'
                ? "Des logements vérifiés, des colocataires vérifiés, un prix tout compris et une réservation en quelques minutes."
                : "Publiez votre annonce gratuitement : Haven s’occupe des réservations, des paiements, des consignes d’accès et des états des lieux."}
            </p>
            <div className="pt-4">
              <button
                onClick={handleStart}
                className="inline-flex items-center gap-2 bg-white text-haven-navy font-bold px-8 py-4 rounded-2xl hover:bg-haven-cream transition-all group shadow-md"
              >
                <span>
                  {activeTab === 'TENANT' ? "Rechercher un logement" : "Publier une annonce"}
                </span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
