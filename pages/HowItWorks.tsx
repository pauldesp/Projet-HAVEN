import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BadgeCheck, Banknote, CalendarCheck, CalendarX, CheckCircle, ClipboardCheck,
  CreditCard, FileText, Home, KeyRound, LifeBuoy, Repeat2, Search, ShieldCheck, Sparkles, UserCheck, Wallet,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Step = { icon: React.ElementType; tone: string; title: string; text: string; details: string[] };
type Fact = { icon: React.ElementType; title: string; text: string };

/** Each step: one short sentence, then at most two practical details. Everything matches how the site really works. */
const TENANT_STEPS: Step[] = [
  {
    icon: UserCheck, tone: 'bg-indigo-50 text-indigo-600', title: 'Faites vérifier votre compte',
    text: 'Une seule fois, avant votre première réservation.',
    details: ['Ajoutez une pièce d’identité et un justificatif de domicile dans « Mon compte ».', 'Haven vérifie votre dossier. Vos justificatifs restent privés.'],
  },
  {
    icon: Search, tone: 'bg-sky-50 text-sky-600', title: 'Trouvez votre chambre',
    text: 'Cherchez par ville et par dates.',
    details: ['Un séjour de quelques nuits à plusieurs mois, ou plusieurs périodes avec la récurrence.', 'La fiche montre la chambre, le logement et les colocataires présents.'],
  },
  {
    icon: CreditCard, tone: 'bg-emerald-50 text-emerald-600', title: 'Réservez et payez',
    text: 'C’est immédiat, sans attendre l’accord du propriétaire.',
    details: ['Le prix affiché comprend tout : nuits, ménage et frais de service.', 'Paiement par carte, sécurisé par Stripe.'],
  },
  {
    icon: KeyRound, tone: 'bg-amber-50 text-amber-600', title: 'Arrivez',
    text: 'Vos consignes d’accès arrivent 72 heures avant.',
    details: ['Le jour J, faites l’état des lieux d’entrée avec quelques photos depuis votre téléphone.', 'Il sert de référence en cas de désaccord.'],
  },
  {
    icon: Home, tone: 'bg-teal-50 text-teal-600', title: 'Vivez votre séjour',
    text: 'Un logement partagé, dont chacun prend soin.',
    details: ['Le propriétaire fait nettoyer les parties communes chaque semaine ; vous rangez et nettoyez derrière vous.', 'Un problème ? Signalez-le depuis « Mes séjours ».'],
  },
  {
    icon: ClipboardCheck, tone: 'bg-rose-50 text-haven-red', title: 'Partez',
    text: 'Laissez la chambre comme vous aimeriez la trouver.',
    details: ['Faites le ménage de votre chambre et des espaces que vous avez utilisés.', 'Validez l’état des lieux de sortie, avec quelques photos, puis laissez un avis.'],
  },
];

const TENANT_FACTS: Fact[] = [
  { icon: Wallet, title: 'Prix tout compris', text: 'Nuits + ménage + 15 % de frais de service. Pas de caution.' },
  { icon: CalendarX, title: 'Annulation', text: '100 % remboursé jusqu’à 30 jours avant, 50 % entre 14 et 29 jours, rien en dessous.' },
  { icon: Repeat2, title: 'Réservation récurrente', text: 'Vous payez le premier séjour ; les suivants sont prélevés un mois avant chaque arrivée.' },
  { icon: LifeBuoy, title: 'En cas de problème', text: 'Haven intervient si le propriétaire ne règle pas la situation.' },
];

const OWNER_STEPS: Step[] = [
  {
    icon: BadgeCheck, tone: 'bg-indigo-50 text-indigo-600', title: 'Faites vérifier votre compte',
    text: 'Identité et justificatif de domicile, une seule fois.',
    details: ['Passez en mode propriétaire avec le bouton à flèches en haut de l’écran.'],
  },
  {
    icon: Banknote, tone: 'bg-emerald-50 text-emerald-600', title: 'Configurez vos versements',
    text: 'Votre compte bancaire, enregistré avec Stripe.',
    details: ['Dans l’onglet Finances de votre espace. Obligatoire avant toute publication.'],
  },
  {
    icon: Home, tone: 'bg-rose-50 text-haven-red', title: 'Publiez votre annonce',
    text: 'Gratuitement, chambre par chambre.',
    details: ['Photos, équipements, règles de la maison et consignes d’accès.', 'Vous fixez le prix par nuit, le forfait ménage et le minimum de nuits.'],
  },
  {
    icon: ShieldCheck, tone: 'bg-violet-50 text-violet-600', title: 'Haven vérifie l’annonce',
    text: 'Avant sa mise en ligne, puis après chaque modification.',
    details: ['Logement propre, chambres meublées, cuisine équipée, ménage des parties communes chaque semaine.'],
  },
  {
    icon: CalendarCheck, tone: 'bg-sky-50 text-sky-600', title: 'Recevez des réservations',
    text: 'Les locataires vérifiés réservent vos dates libres.',
    details: ['Bloquez à l’avance vos dates indisponibles.', 'Haven envoie vos consignes d’accès au locataire 72 heures avant son arrivée.'],
  },
  {
    icon: FileText, tone: 'bg-amber-50 text-amber-600', title: 'Soyez payé',
    text: 'Après l’état des lieux d’entrée de chaque locataire.',
    details: ['Le virement part automatiquement vers votre compte bancaire.', 'Les états des lieux d’entrée et de sortie, avec photos, arrivent dans votre espace.'],
  },
];

const OWNER_FACTS: Fact[] = [
  { icon: Wallet, title: 'Aucune commission', text: 'Vous recevez 100 % des nuits et du forfait ménage. Les frais de service sont payés par le locataire.' },
  { icon: Banknote, title: 'Exemple', text: '6 nuits à 22 € + 15 € de ménage = 147 € pour vous.' },
  { icon: CalendarX, title: 'Annulation', text: 'Seul jusqu’à 30 jours avant l’arrivée. Après, uniquement par Haven, pour un motif sérieux.' },
  { icon: AlertTriangle, title: 'Dégradations', text: 'Les états des lieux avec photos servent de preuve ; Haven examine chaque signalement.' },
];

export const HowItWorks: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'TENANT' | 'OWNER'>('TENANT');
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const steps = activeTab === 'TENANT' ? TENANT_STEPS : OWNER_STEPS;
  const facts = activeTab === 'TENANT' ? TENANT_FACTS : OWNER_FACTS;

  const handleStart = () => {
    if (activeTab === 'TENANT') navigate('/search');
    else navigate(currentUser ? '/owner/publish' : '/login?redirect=/owner/publish&role=OWNER');
  };

  return (
    <div className="bg-haven-cream min-h-screen py-8 sm:py-16 px-4 sm:px-6 lg:px-8 mt-4 sm:mt-12 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">Comment ça marche</span>
          <h1 className="text-[1.75rem] sm:text-5xl font-heading font-black text-haven-navy mt-3 sm:mt-4 mb-3 sm:mb-6 leading-tight">
            Une colocation simple, <br className="hidden sm:inline" />flexible et vérifiée
          </h1>
          <p className="text-sm sm:text-lg text-gray-500 max-w-2xl mx-auto">
            Des chambres meublées en colocation, pour quelques nuits ou plusieurs mois. Voici comment ça se passe.
          </p>
        </div>

        <div className="flex p-1.5 bg-gray-100 rounded-2xl max-w-md mx-auto mb-8 sm:mb-12 shadow-inner" role="group" aria-label="Choisir votre situation">
          {([['TENANT', 'Je suis locataire', Sparkles], ['OWNER', 'Je suis propriétaire', Home]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" aria-pressed={activeTab === id} onClick={() => setActiveTab(id)}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === id ? 'bg-white text-haven-navy shadow-sm' : 'text-gray-500 hover:text-haven-navy'}`}>
              <Icon size={16} aria-hidden="true" />{label}
            </button>
          ))}
        </div>

        {/* Steps: numbered timeline, one short sentence then the practical details. */}
        <ol className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-10 border border-gray-100 shadow-premium mb-6 sm:mb-10">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const last = index === steps.length - 1;
            return (
              <li key={step.title} className="relative flex gap-4 sm:gap-6">
                {!last && <span className="absolute left-[1.375rem] sm:left-[1.75rem] top-12 sm:top-16 bottom-0 w-px bg-gray-100" aria-hidden="true" />}
                <div className={`relative w-11 h-11 sm:w-14 sm:h-14 shrink-0 ${step.tone} rounded-2xl flex items-center justify-center`}>
                  <Icon size={22} aria-hidden="true" />
                </div>
                <div className={`min-w-0 ${last ? '' : 'pb-7 sm:pb-8'}`}>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Étape {index + 1}</p>
                  <h2 className="mt-0.5 text-lg sm:text-xl font-heading font-black text-haven-navy">{step.title}</h2>
                  <p className="mt-1 text-sm sm:text-base font-medium text-gray-700">{step.text}</p>
                  <ul className="mt-2 space-y-1.5">
                    {step.details.map(detail => (
                      <li key={detail} className="flex gap-2.5 text-sm leading-relaxed text-gray-500">
                        <CheckCircle size={16} className="mt-0.5 shrink-0 text-gray-300" aria-hidden="true" />{detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ol>

        {/* The rules people ask about most, in one glance. */}
        <section className="mb-6 sm:mb-10" aria-labelledby="facts-title">
          <h2 id="facts-title" className="mb-4 text-center font-heading text-xl sm:text-2xl font-black text-haven-navy">Bon à savoir</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {facts.map(({ icon: Icon, title, text }, index) => (
              <div key={title} className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-card ${facts.length % 2 && index === facts.length - 1 ? 'sm:col-span-2' : ''}`}>
                <p className="flex items-center gap-2 font-bold text-haven-navy"><Icon size={18} className="text-haven-red" aria-hidden="true" />{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{text}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-sm text-gray-500">
            D’autres questions ? Consultez la <Link to="/faq" className="font-semibold text-haven-red underline underline-offset-4">FAQ</Link>
            {activeTab === 'TENANT' && <> ou le <Link to="/reservation-recurrente" className="font-semibold text-haven-red underline underline-offset-4">guide de la réservation récurrente</Link></>}.
          </p>
        </section>

        <div className="bg-gradient-to-tr from-haven-navy to-slate-900 rounded-[1.75rem] sm:rounded-[2.5rem] p-6 sm:p-12 text-white shadow-premium text-center">
          <div className="max-w-xl mx-auto space-y-5">
            <h2 className="font-heading font-bold text-2xl sm:text-3xl leading-tight">
              {activeTab === 'TENANT' ? 'Prêt à trouver votre chambre ?' : 'Prêt à proposer vos chambres ?'}
            </h2>
            <p className="text-sm text-gray-300 leading-relaxed">
              {activeTab === 'TENANT'
                ? 'Des logements et des colocataires vérifiés, un prix tout compris et une réservation en quelques minutes.'
                : 'Publication gratuite et aucune commission : Haven s’occupe des réservations, des paiements, des consignes d’accès et des états des lieux.'}
            </p>
            <button type="button" onClick={handleStart} className="inline-flex items-center gap-2 bg-white text-haven-navy font-bold px-8 py-4 rounded-2xl hover:bg-haven-cream transition-all group shadow-md">
              {activeTab === 'TENANT' ? 'Rechercher un logement' : 'Publier une annonce'}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
