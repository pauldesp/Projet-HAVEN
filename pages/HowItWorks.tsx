import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, ShieldCheck, CreditCard, Sparkles, Home, FileText, Key, CheckCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

export const HowItWorks: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'TENANT' | 'OWNER'>('TENANT');
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const tenantSteps = [
    {
      icon: Search,
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      title: "1. Recherchez votre colocation active",
      desc: "Explorez nos logements meublés et tout-équipés triés sur le volet. Filtrez par ville, budget, dates de séjour et découvrez les profils des colocataires déjà sur place."
    },
    {
      icon: Calendar,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      title: "2. Réservez en ligne de manière flexible",
      desc: "Grâce à notre colocation court-séjour (flexible de 1 à 12 mois), choisissez vos dates, lisez le cahier des charges : votre paiement vaut acceptation d'un contrat de colocation tripartite."
    },
    {
      icon: CreditCard,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      title: "3. Payez en toute sécurité",
      desc: "Réglez vos frais et virements via notre système Stripe hautement sécurisé de niveau professionnel. Vos fonds sont protégés jusqu'à votre emménagement."
    },
    {
      icon: ShieldCheck,
      iconColor: 'text-teal-600',
      bgColor: 'bg-teal-50',
      title: "4. Réalisez votre Check-in autonome",
      desc: "Le jour de votre arrivée, complétez directement votre état des lieux numérique sur notre application. C'est l'élément juridique infalsifiable qui fait foi."
    }
  ];

  const ownerSteps = [
    {
      icon: Home,
      iconColor: 'text-haven-red',
      bgColor: 'bg-haven-red/5',
      title: "1. Publiez votre annonce gratuitement",
      desc: "Décrivez votre logement meublé, ajoutez des photos, définissez les tarifs globaux et les caractéristiques des chambres disponibles dans votre appartement."
    },
    {
      icon: FileText,
      iconColor: 'text-violet-600',
      bgColor: 'bg-violet-50',
      title: "2. Acceptez le cahier des charges HAVEN",
      desc: "Pour garantir un niveau de qualité professionnel et une colocation respectueuse, chaque propriétaire s'engage contractuellement à respecter notre charte d'équipement d'excellence."
    },
    {
      icon: ShieldCheck,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50',
      title: "3. Validez l'état des lieux numérique",
      desc: "Les états des lieux (check-in / check-out) sont réalisés via l'application par le locataire à son entrée et à sa sortie, et s'enregistrent instantanément dans votre espace propriétaire."
    },
    {
      icon: Key,
      iconColor: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      title: "4. Encaissez vos loyers en direct",
      desc: "Les versements sont transférés directement et de manière automatisée sur votre compte bancaire. Vous pilotez tout depuis votre tableau de bord unifié."
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
    <div className="bg-haven-cream min-h-screen py-16 px-4 sm:px-6 lg:px-8 mt-12 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">
            Guide d'utilisation
          </span>
          <h1 className="text-4xl sm:text-5xl font-heading font-black text-haven-navy mt-4 mb-6 leading-tight">
            Une colocation simple,<br />flexible et professionnelle
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Découvrez la fluidité de la plateforme HAVEN, de la recherche du bien idéal en colocation jusqu'à la gestion autonome des états des lieux.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex p-1.5 bg-gray-100 rounded-2xl max-w-md mx-auto mb-16 shadow-inner">
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
        <div className="bg-white rounded-[2.5rem] p-8 sm:p-12 border border-gray-100 shadow-premium mb-12">
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
        <div className="bg-gradient-to-tr from-haven-navy to-slate-900 rounded-[2.5rem] p-8 sm:p-12 text-white shadow-premium text-center relative overflow-hidden">
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
                ? "Bénéficiez de garanties solides, d'un processus clair et profitez d'une liberté de colocation de courte durée."
                : "Déposez votre annonce, validez notre cahier des charges d'excellence, et laissez notre technologie gérer les visites et états des lieux."}
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
