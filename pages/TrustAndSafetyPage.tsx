import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, Ban, CreditCard, Flag, HomeIcon, KeyRound, Lock, MessageSquare, Phone, ShieldCheck, TriangleAlert, Users2 } from 'lucide-react';

/** What Haven guarantees: one short line each, all true today. */
const GUARANTEES = [
  { icon: BadgeCheck, title: 'Des membres vérifiés', text: 'Identité et domicile contrôlés par l’équipe Haven avant toute réservation ou publication.' },
  { icon: HomeIcon, title: 'Des annonces contrôlées', text: 'Chaque annonce est vérifiée avant sa mise en ligne, puis à chaque modification.' },
  { icon: CreditCard, title: 'Des paiements protégés', text: 'Paiement sécurisé par Stripe ; le propriétaire n’est payé qu’après votre arrivée.' },
  { icon: Users2, title: 'Des règles communes', text: 'Respect, calme et propreté, rappelés à chaque réservation avec les règles du logement.' },
];

/** The advice that prevents the most common rental frauds. */
const TIPS = [
  { icon: Ban, title: 'Ne payez jamais en dehors de Haven', text: 'Pas de virement, d’espèces ni d’acompte demandé par message : en dehors de Haven, vous perdez toutes nos protections.' },
  { icon: MessageSquare, title: 'Échangez par la messagerie Haven', text: 'Méfiez-vous de qui vous demande de poursuivre la conversation par e-mail ou par téléphone avant de réserver.' },
  { icon: TriangleAlert, title: 'Méfiez-vous des offres trop belles', text: 'Un prix très bas, une urgence pressante ou un propriétaire « à l’étranger » sont des signaux d’alerte.' },
  { icon: KeyRound, title: 'Gardez vos accès pour vous', text: 'Ne transmettez jamais vos codes, vos clés ni vos identifiants Haven, même à un colocataire.' },
];

const STEPS = [
  { title: 'Signalez', text: 'Depuis « Mes séjours » pour un problème pendant un séjour, ou avec le bouton « Signaler cette annonce » (le drapeau) sur une fiche logement.' },
  { title: 'Le propriétaire est prévenu', text: 'Il doit vous répondre rapidement et régler la situation.' },
  { title: 'Haven intervient', text: 'Si rien n’est réglé ou si c’est grave : solution, remboursement, annulation, suspension d’une annonce ou d’un compte.' },
];

export const TrustAndSafetyPage: React.FC = () => (
  <div className="bg-haven-cream min-h-screen py-8 sm:py-16 px-4 sm:px-6 lg:px-8 mt-4 sm:mt-12 animate-fade-in">
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-10">
      <div className="text-center">
        <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">Confiance et sécurité</span>
        <h1 className="text-[1.75rem] sm:text-5xl font-heading font-black text-haven-navy mt-3 sm:mt-4 mb-3 sm:mb-6 leading-tight">Votre sécurité, avant tout</h1>
        <p className="text-sm sm:text-lg text-gray-500 max-w-2xl mx-auto">Ce que Haven fait pour vous protéger, les bons réflexes à garder, et que faire si quelque chose ne va pas.</p>
      </div>

      {/* Emergency first: it must be found in a second. */}
      <section className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:gap-5" aria-labelledby="emergency-title">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-haven-red text-white"><Phone size={22} aria-hidden="true" /></div>
        <div>
          <h2 id="emergency-title" className="font-heading text-lg font-black text-red-900">En cas de danger immédiat, appelez le 112</h2>
          <p className="mt-1 text-sm text-red-900/80">Ou le 17 (police), le 18 (pompiers), le 15 (SAMU). Prévenez ensuite Haven depuis « Mes séjours ».</p>
        </div>
      </section>

      <section aria-labelledby="guarantees-title">
        <h2 id="guarantees-title" className="mb-4 font-heading text-xl sm:text-2xl font-black text-haven-navy">Nos garanties</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {GUARANTEES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700"><Icon size={22} aria-hidden="true" /></div>
              <div><h3 className="font-bold text-haven-navy">{title}</h3><p className="mt-1 text-sm leading-relaxed text-gray-600">{text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] sm:rounded-[2.5rem] border border-gray-100 bg-white p-6 sm:p-10 shadow-premium" aria-labelledby="tips-title">
        <h2 id="tips-title" className="flex items-center gap-2 font-heading text-xl sm:text-2xl font-black text-haven-navy"><AlertTriangle size={22} className="text-amber-600" aria-hidden="true" />Évitez les arnaques</h2>
        <ul className="mt-5 grid gap-5 sm:grid-cols-2">
          {TIPS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <Icon size={20} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
              <div><p className="font-bold text-haven-navy">{title}</p><p className="mt-1 text-sm leading-relaxed text-gray-600">{text}</p></div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[1.75rem] sm:rounded-[2.5rem] border border-gray-100 bg-white p-6 sm:p-10 shadow-premium" aria-labelledby="problem-title">
        <h2 id="problem-title" className="flex items-center gap-2 font-heading text-xl sm:text-2xl font-black text-haven-navy"><Flag size={22} className="text-haven-red" aria-hidden="true" />En cas de problème</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {STEPS.map(({ title, text }, index) => (
            <li key={title}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-haven-navy text-sm font-bold text-white">{index + 1}</span>
              <p className="mt-3 font-heading text-lg font-black text-haven-navy">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-gray-500">Une question qui ne concerne pas un séjour ? <Link to="/contact" className="font-semibold text-haven-red underline underline-offset-4">Contactez l’équipe Haven</Link>.</p>
      </section>

      <section className="flex flex-col gap-4 rounded-[1.75rem] sm:rounded-[2.5rem] bg-haven-navy p-6 sm:p-8 text-white sm:flex-row sm:items-center" aria-labelledby="data-title">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"><Lock size={22} aria-hidden="true" /></div>
        <div>
          <h2 id="data-title" className="flex items-center gap-2 font-heading text-lg font-bold"><ShieldCheck size={18} className="text-haven-red" aria-hidden="true" />Vos données sont protégées</h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-300">Vos justificatifs ne sont visibles que par vous et l’équipe Haven, jamais sur votre profil public. Haven ne vend aucune donnée. Téléchargez vos données ou supprimez votre compte à tout moment depuis « Mon compte ».</p>
        </div>
      </section>
    </div>
  </div>
);
