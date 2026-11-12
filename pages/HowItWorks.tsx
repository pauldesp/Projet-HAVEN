import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BadgeCheck, Banknote, CalendarCheck, CalendarX, Camera, CheckCircle, ClipboardCheck,
  CreditCard, FileText, Home, KeyRound, LifeBuoy, Repeat2, Search, ShieldCheck, Sparkles, UserCheck, Wallet,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Step = { icon: React.ElementType; tone: string; title: string; text: string; details: string[] };
type Fact = { icon: React.ElementType; title: string; text: string };

/** Each step: a short sentence, then the practical details. Everything matches how the site really works. */
const TENANT_STEPS: Step[] = [
  {
    icon: UserCheck, tone: 'bg-indigo-50 text-indigo-600', title: 'Créez et faites vérifier votre compte',
    text: 'Une seule fois, avant votre première réservation.',
    details: [
      'Inscrivez-vous avec votre adresse e-mail ou votre numéro de téléphone.',
      'Dans « Mon compte », ajoutez une pièce d’identité et un justificatif de domicile, puis envoyez votre dossier.',
      'L’équipe Haven le vérifie et vous prévient par e-mail. Vos justificatifs ne sont jamais visibles par les autres membres.',
    ],
  },
  {
    icon: Search, tone: 'bg-sky-50 text-sky-600', title: 'Trouvez votre chambre',
    text: 'Cherchez par ville et par dates, pour un séjour ou pour plusieurs.',
    details: [
      '« Réservation unique » : quelques nuits, une semaine ou plusieurs mois, dans la limite du minimum de nuits fixé par chaque logement.',
      '« Récurrence » : indiquez toutes vos périodes (cours, alternance, missions) et comparez les logements disponibles pour chacune.',
      'La fiche d’un logement montre les chambres, les équipements, les règles de la maison et les colocataires déjà présents à vos dates.',
    ],
  },
  {
    icon: CreditCard, tone: 'bg-emerald-50 text-emerald-600', title: 'Réservez et payez',
    text: 'La réservation est instantanée : pas besoin d’attendre l’accord du propriétaire.',
    details: [
      'Le prix affiché comprend tout : les nuits, le forfait ménage et les frais de service Haven (15 % du prix des nuits).',
      'Vous payez par carte sur la page sécurisée de Stripe ; Haven ne voit jamais votre numéro de carte.',
      'Votre réservation est confirmée dès le paiement, par e-mail et dans « Mes séjours ». Une réservation non payée est libérée au bout de 30 minutes.',
    ],
  },
  {
    icon: KeyRound, tone: 'bg-amber-50 text-amber-600', title: 'Recevez vos consignes d’accès',
    text: 'Tout ce qu’il faut pour entrer, 72 heures avant votre arrivée.',
    details: [
      'Adresse exacte, accès à l’immeuble, code ou remise des clés, repères de votre chambre.',
      'Si vous réservez moins de 72 heures avant, elles arrivent dès la confirmation.',
      'Elles restent disponibles dans « Mes séjours » pendant tout le séjour.',
    ],
  },
  {
    icon: Camera, tone: 'bg-teal-50 text-teal-600', title: 'Faites l’état des lieux d’entrée',
    text: 'Le jour de votre arrivée, en quelques minutes depuis votre téléphone.',
    details: [
      'Passez en revue votre chambre et les parties communes, prenez quelques photos et signalez toute anomalie.',
      'Une fois validé, il ne peut plus être modifié : il sert de référence en cas de désaccord à votre départ.',
      'C’est aussi ce qui déclenche le paiement du propriétaire : Haven conserve votre argent jusque-là.',
    ],
  },
  {
    icon: Home, tone: 'bg-sky-50 text-sky-600', title: 'Vivez votre séjour',
    text: 'Une colocation, c’est un logement partagé : chacun en prend soin.',
    details: [
      'Le propriétaire fait réaliser un ménage des parties communes au moins une fois par semaine ; le forfait ménage payé à la réservation y contribue.',
      'Entre deux passages, chacun range et nettoie derrière soi : vaisselle, plan de travail, salle de bain après usage, poubelles et tri.',
      'Un problème (panne, propreté, accès) ? Utilisez « Incident / signalement » dans « Mes séjours » : le propriétaire est prévenu, puis Haven si besoin.',
    ],
  },
  {
    icon: ClipboardCheck, tone: 'bg-rose-50 text-haven-red', title: 'Au départ : ménage et état des lieux de sortie',
    text: 'Laissez la chambre comme vous aimeriez la trouver, puis validez votre départ.',
    details: [
      'Votre chambre : sol aspiré et nettoyé, bureau et rangements essuyés, affaires et déchets retirés, parure de lit placée dans le sac prévu.',
      'Les espaces communs que vous avez utilisés : vaisselle lavée et rangée, plaques et plan de travail nettoyés, vos aliments retirés, douche, lavabo et sanitaires propres, déchets évacués.',
      'Le jour du départ, avant l’heure indiquée, l’état des lieux de sortie vous guide : vous cochez chaque point et ajoutez des photos (chambre, cuisine, parties communes, salle de bain, clés déposées). Vous pouvez ensuite laisser un avis pendant 7 jours.',
    ],
  },
];

const TENANT_FACTS: Fact[] = [
  { icon: Wallet, title: 'Un prix tout compris', text: 'Nuits + ménage + frais de service de 15 % du prix des nuits. Aucun frais caché, aucune caution demandée aujourd’hui.' },
  { icon: CalendarX, title: 'Annulation', text: 'Remboursé à 100 % jusqu’à 30 jours avant l’arrivée, à 50 % entre 14 et 29 jours, pas en dessous. Si le propriétaire annule, vous êtes remboursé intégralement.' },
  { icon: Sparkles, title: 'Le ménage', text: 'Le propriétaire fait réaliser un ménage des parties communes chaque semaine. Vous, vous rangez derrière vous pendant le séjour et laissez votre chambre et les espaces utilisés propres en partant.' },
  { icon: Repeat2, title: 'Réservation récurrente', text: 'Tous vos séjours réservés au même prix. Vous payez le premier ; les suivants sont prélevés un mois avant chaque arrivée, après un rappel 3 jours avant.' },
  { icon: LifeBuoy, title: 'En cas de problème', text: 'Haven peut intervenir à tout moment : solution avec le propriétaire, remboursement ou annulation si le logement ne convient pas.' },
];

const OWNER_STEPS: Step[] = [
  {
    icon: BadgeCheck, tone: 'bg-indigo-50 text-indigo-600', title: 'Créez et faites vérifier votre compte',
    text: 'Comme chaque membre, vous faites vérifier votre identité.',
    details: [
      'Inscrivez-vous, puis passez en mode propriétaire grâce au bouton à flèches en haut de l’écran.',
      'Dans « Mon compte », ajoutez une pièce d’identité et un justificatif de domicile, puis envoyez votre dossier.',
      'L’équipe Haven le vérifie et vous prévient par e-mail.',
    ],
  },
  {
    icon: Banknote, tone: 'bg-emerald-50 text-emerald-600', title: 'Configurez vos versements',
    text: 'Pour recevoir vos revenus directement sur votre compte bancaire.',
    details: [
      'Dans votre espace propriétaire, onglet Finances, suivez les étapes de Stripe, notre prestataire de paiement : identité et coordonnées bancaires.',
      'Cette étape est obligatoire avant la mise en ligne d’une annonce.',
      'Vous suivez ensuite tous vos virements depuis votre espace.',
    ],
  },
  {
    icon: Home, tone: 'bg-rose-50 text-haven-red', title: 'Publiez votre annonce',
    text: 'Gratuitement, en décrivant votre logement chambre par chambre.',
    details: [
      'Ajoutez l’adresse, les photos, les équipements, les règles de la maison et chaque chambre (surface, lit, options comme un bureau ou un verrou).',
      'Fixez librement le prix par nuit de chaque chambre, le forfait ménage par séjour et le nombre minimum de nuits.',
      'Renseignez les consignes d’accès de chaque chambre : elles ne seront envoyées qu’au locataire concerné.',
    ],
  },
  {
    icon: ShieldCheck, tone: 'bg-violet-50 text-violet-600', title: 'Haven vérifie votre annonce',
    text: 'Avant toute mise en ligne, au regard du cahier des charges.',
    details: [
      'Logement propre et en bon état, chambres meublées avec lit, rangement et bureau, cuisine équipée, ménage des parties communes chaque semaine.',
      'Si un point manque, Haven vous indique quoi corriger.',
      'Une annonce modifiée (textes, photos ou adresse) est vérifiée à nouveau avant que les changements soient publiés.',
    ],
  },
  {
    icon: CalendarCheck, tone: 'bg-sky-50 text-sky-600', title: 'Recevez des réservations',
    text: 'Les locataires vérifiés réservent directement vos dates libres.',
    details: [
      'Vous êtes prévenu par e-mail à chaque réservation, y compris pour les réservations récurrentes sur plusieurs périodes.',
      'Bloquez à l’avance les dates où une chambre ou le logement n’est pas disponible, dans l’onglet Disponibilités.',
      'Haven envoie vos consignes d’accès au locataire 72 heures avant son arrivée.',
    ],
  },
  {
    icon: FileText, tone: 'bg-amber-50 text-amber-600', title: 'Suivez les séjours et recevez vos revenus',
    text: 'Les états des lieux arrivent dans votre espace, et le paiement suit.',
    details: [
      'Le locataire fait l’état des lieux d’entrée à son arrivée et de sortie à son départ, avec photos ; au départ, il remet sa chambre et les espaces utilisés en état, en complément de votre ménage hebdomadaire.',
      'Après l’état des lieux d’entrée, votre part est transférée automatiquement, puis virée sur votre compte bancaire par Stripe.',
      'Un signalement ? Vous êtes prévenu et répondez depuis votre espace ; Haven intervient si nécessaire.',
    ],
  },
];

const OWNER_FACTS: Fact[] = [
  { icon: Wallet, title: 'Aucune commission', text: 'Vous recevez 100 % du prix des nuits et du forfait ménage. Les frais de service sont payés par le locataire, et Haven prend en charge les frais bancaires.' },
  { icon: Banknote, title: 'Quand êtes-vous payé ?', text: 'Après l’arrivée de chaque locataire, séjour par séjour. Exemple : 6 nuits à 22 € + 15 € de ménage = 147 € pour vous.' },
  { icon: CalendarX, title: 'Annulation', text: 'Vous pouvez annuler seul jusqu’à 30 jours avant l’arrivée (le locataire est remboursé intégralement). Plus tard, seule Haven peut annuler, pour un motif sérieux.' },
  { icon: AlertTriangle, title: 'Dégradations', text: 'Les états des lieux avec photos servent de preuve. Signalez toute dégradation depuis votre espace : Haven examine le dossier et recherche une solution amiable.' },
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
            Haven met en relation des propriétaires de chambres meublées et des locataires vérifiés, pour quelques nuits comme pour plusieurs mois. Voici comment cela se passe, étape par étape.
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
                <div className={`min-w-0 ${last ? '' : 'pb-8 sm:pb-10'}`}>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Étape {index + 1}</p>
                  <h2 className="mt-0.5 text-lg sm:text-xl font-heading font-black text-haven-navy">{step.title}</h2>
                  <p className="mt-1 text-sm sm:text-base font-medium text-gray-700">{step.text}</p>
                  <ul className="mt-3 space-y-2">
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
