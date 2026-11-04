import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, CreditCard, MapPin, Repeat2, ShieldCheck } from 'lucide-react';

const steps = [
  { Icon: CalendarDays, title: 'Renseigne tous tes séjours', text: 'Choisis ta ville, puis les dates de ton premier séjour, du second et des suivants. Quelques jours chaque semaine ou des semaines espacées : tu construis ton propre planning.' },
  { Icon: MapPin, title: 'Compare les logements', text: 'Repère les dates disponibles sur chaque annonce. Un logement peut correspondre à une partie de ton planning ; lorsqu’une autre solution existe à proximité pour compléter, Haven te la propose.' },
  { Icon: ShieldCheck, title: 'Confirme tes réservations', text: 'Vérifie les dates, la chambre, le prix et les conditions avant de t’engager. Selon l’annonce, la réservation est immédiate ou soumise à l’accord du propriétaire.' },
];

export function RecurringBookingGuide() {
  return <div className="mx-auto max-w-5xl px-5 py-6 pb-16 sm:px-8 sm:py-10">
    <Link to="/" className="inline-flex min-h-[44px] items-center gap-2 text-sm text-gray-500 hover:text-haven-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"><ArrowLeft size={16} />Retour à la recherche</Link>

    <section className="mt-5 rounded-3xl bg-haven-navy px-6 py-9 text-white sm:p-12">
      <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-white/75"><Repeat2 size={16} />LA RÉSERVATION RÉCURRENTE</span>
      <h1 className="mt-4 max-w-2xl font-heading text-2xl font-bold leading-tight sm:text-5xl">Tu reviens souvent&nbsp;?<br />Prépare tous tes séjours.</h1>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/85">Tes semaines de cours, ton alternance ou tes déplacements réguliers : retrouve une chambre en colocation qui s’adapte à ton planning.</p>
      <p className="mt-5 text-sm leading-relaxed text-white/70">Pas besoin de revenir chaque semaine : choisis seulement les périodes dont tu as besoin.</p>
    </section>

    <section className="mt-10" aria-labelledby="recurring-steps">
      <h2 id="recurring-steps" className="font-heading text-2xl font-bold">Comment ça marche ?</h2>
      <ol className="mt-5 grid gap-4 md:grid-cols-3">
        {steps.map(({ Icon, title, text }, index) => <li key={title} className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between text-haven-red"><Icon size={23} aria-hidden="true" /><span className="text-xs font-semibold text-gray-400">0{index + 1}</span></div>
          <h3 className="mt-5 font-heading text-lg font-bold">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{text}</p>
        </li>)}
      </ol>
    </section>

    <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 sm:p-8" aria-labelledby="recurring-payment">
      <h2 id="recurring-payment" className="flex items-center gap-3 font-heading text-2xl font-bold"><CreditCard size={24} className="shrink-0 text-haven-red" />Un budget clair, séjour par séjour</h2>
      <p className="mt-4 text-sm leading-relaxed text-gray-600">Les annonces affichent d’abord le prix moyen par nuit, frais inclus, puis le montant du premier séjour, le total des séjours disponibles et le montant des suivants. Le détail à confirmer est présenté avant chaque paiement.</p>
      <div className="mt-5 rounded-2xl bg-haven-cream p-5 text-sm leading-relaxed">
        <h3 className="font-bold">Le fonctionnement prévu pour la récurrence</h3>
        <p className="mt-2 text-gray-600">Le premier séjour sera payé à la réservation. Les suivants seront payés un mois avant chaque arrivée ; un séjour réservé moins d’un mois avant son début sera payable immédiatement.</p>
        <p className="mt-3 text-xs text-gray-500">Pour le moment, la recherche de plusieurs séjours est disponible, mais chaque séjour se réserve et se paie séparément. Le paiement automatique des séjours suivants n’est pas encore disponible.</p>
      </div>
      <h3 className="mt-6 font-bold">Quels moyens de paiement ?</h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">Le paiement se fait par carte bancaire sur la page sécurisée Stripe. Les moyens de paiement effectivement disponibles s’affichent au moment de payer. Aucune réservation n’est créée par une simple recherche.</p>
    </section>

    <section className="mt-10" aria-labelledby="recurring-questions">
      <h2 id="recurring-questions" className="font-heading text-2xl font-bold">Et si mon planning change ?</h2>
      <div className="mt-5 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white px-5 sm:px-7">
        {[
          { question: 'Puis-je annuler un séjour ?', answer: <><p>Les conditions et le remboursement éventuel se vérifient pour chaque réservation. Pour un séjour confirmé, les règles actuellement appliquées par Haven sont :</p><ul className="mt-3 list-disc space-y-2 pl-5"><li>Au moins 30 jours avant l’arrivée : remboursement intégral.</li><li>Entre 14 et 29 jours avant : remboursement de 50 %.</li><li>Moins de 14 jours avant : aucun remboursement.</li></ul><p className="mt-3">Vérifie les conditions de ta réservation et le montant proposé avant de confirmer une annulation. Les règles de la future réservation récurrente pourront évoluer.</p></> },
          { question: 'Puis-je modifier mes dates ?', answer: <p>Avant de réserver, ajoute, retire ou modifie librement tes séjours dans la recherche. Après réservation, une modification dépend des disponibilités et de l’accord du propriétaire ; elle peut changer le prix. Contacte le propriétaire via la messagerie ou l’équipe Haven avant d’annuler pour réserver d’autres dates. La modification automatique d’une réservation n’est pas encore disponible.</p> },
          { question: 'Est-ce que je garde la même chambre ?', answer: <p>Quand c’est possible, l’annonce indique « Même chambre possible ». Cela reste à vérifier pour la chambre choisie avant de confirmer chaque séjour. Si une chambre différente est nécessaire, l’information apparaît dans les résultats. Tu peux aussi compléter les dates manquantes dans un autre logement disponible.</p> },
          { question: 'Puis-je rester le week-end ou ajouter une période ?', answer: <p>Oui, tu peux rechercher un séjour qui inclut le week-end, ou ajouter une nouvelle période à ton planning. La réservation dépend des disponibilités et de la durée minimale fixée par le propriétaire. Le prix proposé est celui des dates sélectionnées : aucune réduction récurrente ou week-end n’est automatique à ce jour.</p> },
          { question: 'Toutes mes dates sont-elles bloquées dès la recherche ?', answer: <p>Non. La recherche te permet de comparer les disponibilités sans bloquer de chambre. Chaque séjour doit ensuite suivre le parcours de réservation et, si nécessaire, être accepté par le propriétaire. Réfère-toi au statut de chaque réservation dans ton espace pour connaître sa confirmation.</p> },
        ].map(({ question, answer }) => <details key={question} className="group py-2">
          <summary className="cursor-pointer py-4 text-sm font-semibold leading-relaxed focus-visible:outline focus-visible:outline-2 focus-visible:outline-haven-red">{question}</summary>
          <div className="pb-5 text-sm leading-relaxed text-gray-600">{answer}</div>
        </details>)}
      </div>
    </section>

    <div className="mt-8 flex flex-col items-start justify-between gap-5 rounded-2xl bg-white p-6 sm:flex-row sm:items-center">
      <div><p className="font-bold">Un doute sur ton planning ?</p><Link to="/contact" className="mt-1 inline-flex min-h-[44px] items-center text-sm text-haven-red underline underline-offset-4">Contacter l’équipe Haven</Link></div>
      <Link to="/" className="inline-flex min-h-[48px] items-center justify-center gap-3 rounded-xl bg-haven-navy px-5 py-3 text-sm font-semibold text-white hover:bg-haven-red">Préparer mes séjours<ArrowRight size={17} /></Link>
    </div>
  </div>;
}
