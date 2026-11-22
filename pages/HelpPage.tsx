import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ClipboardList, Mail, Search } from 'lucide-react';

type Theme = 'BOOK' | 'PAY' | 'STAY' | 'OWNER';
interface Question { theme: Theme; q: string; a: string }

const THEMES: { id: Theme; label: string }[] = [
  { id: 'BOOK', label: 'Réserver' },
  { id: 'PAY', label: 'Payer' },
  { id: 'STAY', label: 'Pendant le séjour' },
  { id: 'OWNER', label: 'Propriétaires' },
];

/** Single source for help: former FAQ and help centre merged, every answer matching how the site works. */
const QUESTIONS: Question[] = [
  { theme: 'BOOK', q: 'Comment fonctionne Haven ?', a: 'Haven met en relation des propriétaires de chambres meublées en colocation et des locataires vérifiés : étudiants, stagiaires, alternants, jeunes actifs. Vous cherchez par ville et par dates, réservez et payez en ligne, recevez vos consignes d’accès 72 heures avant l’arrivée, puis faites l’état des lieux d’entrée depuis votre téléphone.' },
  { theme: 'BOOK', q: 'Qui peut réserver ?', a: 'Toute personne majeure dont le compte a été vérifié. Dans « Mon compte », ajoutez une pièce d’identité et un justificatif de domicile, acceptez les conditions générales et envoyez votre dossier. L’équipe Haven le vérifie et vous prévient par e-mail. Vos justificatifs ne figurent jamais sur votre profil public.' },
  { theme: 'BOOK', q: 'Combien de temps puis-je rester ?', a: 'Chaque logement fixe un nombre minimum de nuits, indiqué sur son annonce. Il n’y a pas de durée maximale. Un séjour plus court que le minimum peut être accepté s’il occupe exactement l’intervalle libre entre deux réservations de la même chambre (2 nuits au moins).' },
  { theme: 'BOOK', q: 'Le propriétaire doit-il accepter ma réservation ?', a: 'Non. La réservation est instantanée : dès que votre paiement est accepté, elle est confirmée et vous recevez un e-mail. Le propriétaire en est informé aussitôt.' },
  { theme: 'BOOK', q: 'Qu’est-ce que la réservation récurrente ?', a: 'Elle permet de réserver en une fois plusieurs séjours répartis dans le temps, par exemple une semaine par mois pour une alternance. Tous les séjours sont réservés et leurs prix fixés dès le départ. Vous payez le premier ; les suivants sont prélevés automatiquement un mois avant chaque arrivée, après un rappel trois jours avant.' },
  { theme: 'BOOK', q: 'Les logements sont-ils vérifiés ?', a: 'Oui. Chaque annonce est examinée par Haven avant sa mise en ligne, et à nouveau dès que ses textes, ses photos ou son adresse changent, au regard du cahier des charges : logement propre et en bon état, chambres meublées, cuisine équipée, ménage des parties communes chaque semaine.' },
  { theme: 'BOOK', q: 'Avec qui vais-je partager le logement ?', a: 'La fiche du logement indique les colocataires déjà confirmés aux mêmes dates, avec un aperçu de leur profil. Tous les membres de Haven ont un compte vérifié.' },
  { theme: 'BOOK', q: 'Les animaux, le tabac ou les invités sont-ils acceptés ?', a: 'Chaque logement a ses propres règles de la maison, indiquées sur sa fiche. Vous les acceptez en réservant ; elles vous sont rappelées dans la confirmation. En cas de doute, posez la question au propriétaire depuis la messagerie avant de réserver.' },
  { theme: 'BOOK', q: 'Puis-je annuler ma réservation ?', a: 'Oui, depuis « Mes séjours ». Vous êtes remboursé à 100 % si vous annulez au moins 30 jours avant l’arrivée, à 50 % entre 14 et 29 jours, et pas en dessous. Un séjour d’une série pas encore prélevé s’annule sans frais. Il n’y a pas de droit de rétractation pour un hébergement à dates fixes.' },
  { theme: 'BOOK', q: 'Que se passe-t-il si le propriétaire annule ?', a: 'Un propriétaire ne peut annuler seul qu’au moins 30 jours avant votre arrivée, et vous êtes alors remboursé intégralement. Plus tard, seule Haven peut annuler, pour un motif sérieux, avec un remboursement intégral.' },

  { theme: 'PAY', q: 'Combien coûte un séjour ?', a: 'Le prix affiché avant de payer comprend tout : le prix des nuits fixé par le propriétaire, un forfait ménage par séjour et les frais de service Haven, égaux à 15 % du prix des nuits. Aucun frais caché.' },
  { theme: 'PAY', q: 'Quand et comment suis-je débité ?', a: 'Par carte bancaire, sur la page sécurisée de Stripe ; Haven ne voit jamais votre numéro de carte. Un séjour simple est payé en totalité à la réservation, qui est libérée si elle n’est pas payée dans les 30 minutes. Pour une série, seul le premier séjour est payé à la réservation.' },
  { theme: 'PAY', q: 'Que se passe-t-il si un prélèvement automatique échoue ?', a: 'Vous êtes prévenu par e-mail et pouvez payer le séjour depuis votre espace. Une nouvelle tentative a lieu 48 heures plus tard. Sans paiement 5 jours après la date prévue, ce seul séjour est annulé ; les autres séjours de votre série sont maintenus.' },
  { theme: 'PAY', q: 'Une caution est-elle demandée ?', a: 'Oui, une caution de 300 €, mais rien n’est bloqué ni débité. Votre carte est conservée de façon sécurisée par Stripe. Si le propriétaire déclare une dégradation dans les 7 jours suivant votre départ, vous la voyez dans votre espace et pouvez y répondre. Haven compare avec les états des lieux d’entrée et de sortie, lit votre réponse, puis décide. Seul le montant retenu, 300 € au plus, est alors prélevé.' },
  { theme: 'PAY', q: 'Quand vais-je être remboursé ?', a: 'Le remboursement est fait sur la carte utilisée pour payer. Il apparaît sous 5 à 10 jours selon votre banque.' },

  { theme: 'STAY', q: 'Quand vais-je recevoir l’adresse et les codes d’accès ?', a: 'Les consignes d’entrée (adresse exacte, accès, clés ou code, repères de votre chambre) vous sont envoyées 72 heures avant votre arrivée, ou dès la confirmation si vous réservez à la dernière minute. Elles restent disponibles dans « Mes séjours ».' },
  { theme: 'STAY', q: 'Comment se passe l’état des lieux d’entrée ?', a: 'Le jour de votre arrivée, à partir de l’heure d’arrivée, vous le réalisez depuis « Mes séjours » : quelques photos et un constat de votre chambre et des parties communes. Signalez-y toute anomalie : une fois validé, il fait foi et ne peut plus être modifié.' },
  { theme: 'STAY', q: 'Qui fait le ménage ?', a: 'Le ménage est partagé. Le propriétaire fait réaliser un ménage des parties communes au moins une fois par semaine ; le forfait ménage y contribue. Pendant votre séjour, vous rangez et nettoyez derrière vous (vaisselle, cuisine, salle de bain, poubelles).' },
  { theme: 'STAY', q: 'Que dois-je faire avant de partir ?', a: 'Le jour du départ, avant l’heure indiquée, l’état des lieux de sortie vous guide point par point : ménage de votre chambre et des espaces utilisés, affaires et aliments retirés, parure de lit dans le sac prévu, équipements éteints, clés déposées. Vous ajoutez quelques photos. Si vous partez plus tôt, vous pouvez le faire dès votre départ ; les nuits non utilisées ne sont pas remboursées.' },
  { theme: 'STAY', q: 'Que faire en cas de problème pendant le séjour ?', a: 'Utilisez « Incident / signalement » dans « Mes séjours », avec une description et une photo si possible. Le propriétaire est prévenu et doit vous répondre rapidement. Si le problème n’est pas résolu ou s’il est grave, vous pouvez demander l’intervention de Haven, qui peut proposer une solution, un remboursement ou une annulation.' },
  { theme: 'STAY', q: 'Puis-je laisser un avis ?', a: 'Oui. À la fin du séjour, locataire et propriétaire disposent de 7 jours pour se laisser un avis. Seuls les membres ayant réellement séjourné peuvent noter un logement, et les avis ne sont ni payés ni triés selon leur note.' },

  { theme: 'OWNER', q: 'Comment proposer mon logement ?', a: 'Faites vérifier votre compte, puis configurez vos versements avec Stripe (identité et compte bancaire) dans l’onglet Finances. Choisissez ensuite « Ajouter un logement » : décrivez le logement et chaque chambre, ajoutez vos photos, vos prix, votre forfait ménage, votre minimum de nuits et vos consignes d’accès. Haven vérifie l’annonce avant sa mise en ligne.' },
  { theme: 'OWNER', q: 'Combien cela me coûte-t-il ?', a: 'Rien. La publication est gratuite et vous recevez 100 % du prix des nuits et du forfait ménage que vous fixez. Les frais de service Haven sont payés par le locataire, et Haven prend en charge les frais bancaires.' },
  { theme: 'OWNER', q: 'Quand suis-je payé ?', a: 'Après l’arrivée de chaque locataire, une fois son état des lieux d’entrée enregistré. Le virement part automatiquement vers votre compte bancaire, séjour par séjour. En cas de litige signalé, Haven peut suspendre ce versement le temps de l’examiner.' },
  { theme: 'OWNER', q: 'Comment bloquer des dates ?', a: 'Dans la modification de votre annonce, onglet Disponibilités : bloquez tout le logement ou une seule chambre. Bloquer des dates n’annule jamais une réservation existante.' },
  { theme: 'OWNER', q: 'Puis-je annuler une réservation ?', a: 'Oui, seul, jusqu’à 30 jours avant l’arrivée ; le locataire est alors remboursé intégralement. Plus tard, seule Haven peut annuler, pour un motif sérieux.' },
];

const normalize = (text: string) => text.toLocaleLowerCase('fr').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Help: one searchable page, questions grouped by theme in accordions. Replaces the FAQ and the help centre. */
export const HelpPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<Theme | 'ALL'>('ALL');
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    const matches = QUESTIONS.filter(item => (theme === 'ALL' || item.theme === theme)
      && words.every(word => normalize(`${item.q} ${item.a}`).includes(word)));
    return THEMES.map(t => ({ ...t, items: matches.filter(item => item.theme === t.id) })).filter(group => group.items.length);
  }, [query, theme]);

  return (
    <div className="bg-haven-cream min-h-screen py-8 sm:py-16 px-4 sm:px-6 lg:px-8 mt-4 sm:mt-12 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6 sm:mb-10">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-bold uppercase tracking-widest">Aide</span>
          <h1 className="text-[1.75rem] sm:text-4xl font-heading font-bold text-haven-navy mt-4 mb-3">Comment pouvons-nous vous aider ?</h1>
          <p className="text-gray-500 text-sm sm:text-base">Réservation, paiement, séjour, propriétaires : toutes les réponses au même endroit.</p>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 shadow-card focus-within:border-haven-navy">
          <Search size={20} className="shrink-0 text-gray-400" aria-hidden="true" />
          <span className="sr-only">Rechercher une question</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher (ex. : annulation, ménage, paiement…)"
            className="h-14 w-full bg-transparent text-sm text-haven-navy placeholder-gray-400 focus:outline-none" />
        </label>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer par thème">
          {[{ id: 'ALL' as const, label: 'Tout' }, ...THEMES].map(item => (
            <button key={item.id} type="button" aria-pressed={theme === item.id} onClick={() => setTheme(item.id)}
              className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${theme === item.id ? 'border-haven-navy bg-haven-navy text-white' : 'border-gray-200 bg-white text-haven-navy hover:border-haven-navy/40'}`}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-8">
          {groups.map(group => (
            <section key={group.id} aria-labelledby={`help-${group.id}`}>
              <h2 id={`help-${group.id}`} className="mb-3 font-heading text-lg font-bold text-haven-navy">{group.label}</h2>
              <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-card">
                {group.items.map(item => {
                  const isOpen = open === item.q || query.trim().length > 2;
                  return (
                    <div key={item.q}>
                      <button type="button" aria-expanded={isOpen} onClick={() => setOpen(open === item.q ? null : item.q)}
                        className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-3 text-left font-semibold text-haven-navy">
                        {item.q}
                        <ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>
                      {isOpen && <p className="px-5 pb-5 text-sm leading-relaxed text-gray-600">{item.a}</p>}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {!groups.length && <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Aucune réponse pour cette recherche. Essayez un autre mot, ou contactez-nous.</p>}
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          Pour aller plus loin : <Link to="/how-it-works" className="font-semibold text-haven-red underline underline-offset-4">Comment ça marche</Link> et le <Link to="/reservation-recurrente" className="font-semibold text-haven-red underline underline-offset-4">guide de la réservation récurrente</Link>.
        </p>

        {/* Two clear ways out: a stay issue goes through the stay, anything else through Contact. */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link to="/dashboard" className="flex gap-4 rounded-2xl bg-haven-navy p-5 text-white transition-colors hover:bg-haven-navy-deep">
            <ClipboardList size={22} className="mt-0.5 shrink-0 text-haven-red" aria-hidden="true" />
            <span><span className="block font-bold">Un problème pendant un séjour ?</span><span className="mt-1 block text-sm text-gray-300">Signalez-le depuis « Mes séjours » : le propriétaire est prévenu, puis Haven si besoin.</span></span>
          </Link>
          <Link to="/contact" className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-haven-navy/40">
            <Mail size={22} className="mt-0.5 shrink-0 text-haven-red" aria-hidden="true" />
            <span><span className="block font-bold text-haven-navy">Une autre question ?</span><span className="mt-1 block text-sm text-gray-500">Écrivez à l’équipe Haven, qui vous répond par e-mail.</span></span>
          </Link>
        </div>
      </div>
    </div>
  );
};
