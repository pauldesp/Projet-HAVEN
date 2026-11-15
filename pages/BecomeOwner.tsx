import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BadgeCheck, CalendarRange, Check, ChevronRight, Home, KeyRound, ShieldCheck, SlidersHorizontal, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/** Reasons to join, all true today: shown first, before the details. */
const REASONS = [
  { icon: Wallet, title: '0 % de commission', text: 'Vous gardez 100 % du prix de vos nuits et de votre forfait ménage. Les frais de service sont payés par le locataire.' },
  { icon: ShieldCheck, title: 'Fini les impayés', text: 'Chaque séjour est payé en ligne au moment de la réservation. Haven vous le verse après l’arrivée du locataire.' },
  { icon: CalendarRange, title: 'Moins de chambres vides', text: 'Stagiaires, alternants, étudiants en mobilité : ils réservent quelques semaines ou plusieurs périodes dans l’année, et les séjours courts comblent les trous entre deux locations.' },
  { icon: BadgeCheck, title: 'Des locataires vérifiés', text: 'Personne ne réserve sans avoir fait vérifier son identité et son domicile par l’équipe Haven.' },
  { icon: KeyRound, title: 'Vous gérez moins', text: 'Réservation instantanée, consignes d’accès envoyées automatiquement, états des lieux avec photos : plus de remises de clés ni de relances.' },
  { icon: SlidersHorizontal, title: 'Vous gardez la main', text: 'Vos prix, votre forfait ménage, votre minimum de nuits, vos dates bloquées. Publication gratuite, sans engagement.' },
];

/** What Haven does, and what stays with the owner: stated plainly, matching how the site works. */
const HAVEN_DOES = [
  'Vérifie l’identité et le domicile de chaque locataire avant qu’il puisse réserver',
  'Encaisse le paiement à la réservation : pas d’impayé, pas de relance',
  'Envoie vos consignes d’accès au locataire 72 heures avant son arrivée',
  'Fait réaliser les états des lieux d’entrée et de sortie, avec photos',
  'Suit les incidents et intervient si une situation n’est pas réglée',
];
const YOU_DO = [
  'Décrire votre logement et tenir vos disponibilités à jour',
  'Faire réaliser un ménage des parties communes chaque semaine pendant les séjours',
  'Remettre les chambres en état entre deux locataires',
  'Répondre rapidement aux signalements des locataires',
];
const QUESTIONS = [
  { q: 'Quand suis-je payé ?', a: 'Après l’arrivée de chaque locataire, une fois son état des lieux d’entrée enregistré. Le virement part automatiquement vers votre compte bancaire, séjour par séjour.' },
  { q: 'Est-ce que je choisis mes locataires ?', a: 'Les locataires dont le compte a été vérifié par Haven réservent directement vos dates libres, sans demande à valider. Vous voyez qui a réservé dans votre espace, et vous bloquez à l’avance les dates où une chambre n’est pas disponible.' },
  { q: 'Et en cas de dégradation ?', a: 'Les états des lieux avec photos servent de preuve. Dans les 7 jours suivant le départ, vous déclarez la dégradation depuis vos réservations, avec photos et devis. Haven examine le dossier et la réponse du locataire ; si la dégradation est retenue, Haven prélève jusqu’à 300 € sur la carte du locataire et vous les reverse.' },
  { q: 'Puis-je annuler une réservation ?', a: 'Oui, seul, jusqu’à 30 jours avant l’arrivée ; le locataire est alors remboursé intégralement. Plus tard, seule Haven peut annuler, pour un motif sérieux.' },
  { q: 'Que dois-je faire avant de publier ?', a: 'Faire vérifier votre compte (identité et domicile), puis configurer vos versements avec Stripe (identité et compte bancaire). Haven vérifie ensuite votre annonce avant sa mise en ligne.' },
];
const STANDARDS = [
  'Un logement décent, propre et en bon état, adapté à la vie à plusieurs',
  'Des chambres meublées : lit et literie, rangement, bureau, éclairage et occultation',
  'Une cuisine équipée et des parties communes fonctionnelles',
  'Pour chaque chambre, au moins une option : salle de bain privée, bureau, verrou ou armoire',
];

export const BecomeOwner: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const startPublishing = () => navigate(currentUser ? '/owner/publish' : '/login?redirect=/owner/publish&role=OWNER');

  return (
    <div className="bg-haven-cream min-h-screen py-8 sm:py-16 px-4 sm:px-6 lg:px-8 mt-4 sm:mt-12 animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-10">
        <div className="text-center">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">Propriétaires</span>
          <h1 className="text-[1.75rem] sm:text-5xl font-heading font-black text-haven-navy mt-3 sm:mt-4 mb-3 sm:mb-6 leading-tight">
            Vos chambres louées, <br className="hidden sm:inline" />vos revenus sans commission
          </h1>
          <p className="text-sm sm:text-lg text-gray-500 max-w-2xl mx-auto">
            Des locataires vérifiés qui paient d’avance, pour quelques semaines ou plusieurs mois. Haven s’occupe des réservations, des paiements et des états des lieux ; vous gardez 100 % de vos revenus.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button type="button" onClick={startPublishing} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-haven-red px-7 font-extrabold text-white shadow-lg transition-all hover:bg-red-700">
              Publier gratuitement <ChevronRight size={18} aria-hidden="true" />
            </button>
            <a href="#earn-title" onClick={event => { event.preventDefault(); document.getElementById('earn-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} className="inline-flex min-h-12 items-center rounded-2xl px-5 font-semibold text-haven-navy underline-offset-4 hover:underline">
              Voir combien je gagne
            </a>
          </div>
          <p className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-semibold text-gray-500">
            {['Publication gratuite', '0 % de commission', 'Payé à chaque réservation'].map(item => <span key={item} className="inline-flex items-center gap-1.5"><Check size={14} className="text-green-600" aria-hidden="true" />{item}</span>)}
          </p>
        </div>

        {/* Why Haven: the benefits first. */}
        <section aria-labelledby="reasons-title">
          <h2 id="reasons-title" className="mb-4 text-center font-heading text-xl sm:text-2xl font-black text-haven-navy">Pourquoi proposer vos chambres sur Haven</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {REASONS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-haven-red/5 text-haven-red"><Icon size={22} aria-hidden="true" /></div>
                <h3 className="mt-3 font-heading text-lg font-black text-haven-navy">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 1. What the owner earns, with the real computation. */}
        <section className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] border border-gray-100 shadow-premium p-6 sm:p-10" aria-labelledby="earn-title">
          <h2 id="earn-title" className="font-heading font-black text-xl sm:text-2xl text-haven-navy">Combien vous gagnez</h2>
          <p className="mt-2 text-sm sm:text-base text-gray-600">Vous fixez le prix par nuit de chaque chambre et un forfait ménage par séjour, et vous recevez <strong className="text-haven-navy">100 % de ces montants</strong>. Les frais de service Haven sont payés par le locataire, en plus.</p>
          <div className="mt-6 rounded-2xl bg-gray-50 p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Exemple : une chambre à 22 € la nuit, un séjour de 6 nuits</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-gray-600">6 nuits × 22 €</dt><dd className="font-semibold text-haven-navy">132 €</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-gray-600">Forfait ménage</dt><dd className="font-semibold text-haven-navy">15 €</dd></div>
              <div className="flex justify-between gap-4 border-t border-gray-200 pt-3 text-base"><dt className="font-bold text-haven-navy">Versé sur votre compte</dt><dd className="font-black text-haven-navy">147 €</dd></div>
              <div className="flex justify-between gap-4 text-xs text-gray-400"><dt>Payé par le locataire, avec 20 € de frais de service</dt><dd>167 €</dd></div>
            </dl>
          </div>
        </section>

        {/* 2. Who does what. */}
        <section className="grid gap-4 sm:gap-6 md:grid-cols-2" aria-label="Qui fait quoi">
          {([['Haven s’occupe de', HAVEN_DOES, 'text-green-600'], ['Votre rôle', YOU_DO, 'text-haven-navy']] as const).map(([title, items, tone]) => (
            <div key={title} className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] border border-gray-100 shadow-premium p-6 sm:p-8">
              <h2 className="font-heading font-black text-lg sm:text-xl text-haven-navy">{title}</h2>
              <ul className="mt-4 space-y-3">
                {items.map(item => <li key={item} className="flex gap-2.5 text-sm text-gray-600"><Check size={16} className={`${tone} shrink-0 mt-0.5`} aria-hidden="true" />{item}</li>)}
              </ul>
            </div>
          ))}
        </section>

        {/* 3. The questions owners ask. */}
        <section className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] border border-gray-100 shadow-premium p-6 sm:p-10" aria-labelledby="owner-questions">
          <h2 id="owner-questions" className="font-heading font-black text-xl sm:text-2xl text-haven-navy">Vos questions</h2>
          <div className="mt-4 divide-y divide-gray-100">
            {QUESTIONS.map(({ q, a }) => (
              <details key={q} className="group py-1">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-haven-navy">
                  {q}<ChevronRight size={18} className="shrink-0 text-gray-400 transition-transform group-open:rotate-90" aria-hidden="true" />
                </summary>
                <p className="pb-4 text-sm leading-relaxed text-gray-600">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-4 text-sm text-gray-500">Le fonctionnement complet, étape par étape : <Link to="/how-it-works" className="font-semibold text-haven-red underline underline-offset-4">Comment ça marche</Link>.</p>
        </section>

        {/* 4. Standards, then publish. */}
        <section className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] border border-gray-100 shadow-premium p-6 sm:p-10" aria-labelledby="standards-title">
          <h2 id="standards-title" className="flex items-center gap-2 font-heading font-black text-xl sm:text-2xl text-haven-navy"><ShieldCheck size={22} className="text-haven-red" aria-hidden="true" />Le cahier des charges</h2>
          <p className="mt-2 text-sm text-gray-600">Chaque annonce est vérifiée par Haven avant sa mise en ligne. Votre logement doit notamment offrir :</p>
          <ul className="mt-4 space-y-3">
            {STANDARDS.map(item => <li key={item} className="flex gap-2.5 text-sm text-gray-600"><Check size={16} className="text-haven-red shrink-0 mt-0.5" aria-hidden="true" />{item}</li>)}
          </ul>
        </section>

        <div className="bg-haven-navy rounded-[1.75rem] sm:rounded-[2.5rem] p-6 sm:p-12 text-white shadow-premium text-center">
          <Home size={28} className="mx-auto text-haven-red" aria-hidden="true" />
          <h2 className="mt-3 font-heading font-bold text-2xl sm:text-3xl">Prêt à louer vos chambres ?</h2>
          <p className="mt-3 text-sm text-gray-300 max-w-xl mx-auto">Publication gratuite, sans engagement : créez votre compte, décrivez votre logement, Haven vérifie l’annonce et la met en ligne.</p>
          <button type="button" onClick={startPublishing} className="mt-6 px-8 py-4 bg-haven-red text-white font-extrabold rounded-2xl hover:bg-red-700 transition-all shadow-lg inline-flex items-center gap-2">
            Publier gratuitement <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
