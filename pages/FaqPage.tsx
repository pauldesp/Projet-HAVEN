import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Search } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
  category: 'RESERVATION' | 'PAYMENT' | 'INVENTORY' | 'HOUSING';
}

export const FaqPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'RESERVATION' | 'PAYMENT' | 'INVENTORY' | 'HOUSING'>('ALL');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const faqItems: FaqItem[] = [
    { category: 'RESERVATION', question: "Qui peut réserver sur Haven ?", answer: "Toute personne majeure dont le compte a été vérifié par Haven. Après votre inscription, vous transmettez une pièce d’identité et un justificatif de domicile depuis « Mon compte » ; un membre de l’équipe vérifie votre dossier. Vous pouvez ensuite réserver directement." },
    { category: 'RESERVATION', question: "Combien de temps puis-je rester ?", answer: "Chaque logement fixe un nombre minimum de nuits, indiqué sur son annonce. Il n’y a pas de durée maximale : vous pouvez réserver quelques nuits comme plusieurs mois. Un séjour plus court que le minimum peut être accepté s’il occupe exactement l’intervalle libre entre deux réservations de la même chambre (2 nuits au moins)." },
    { category: 'RESERVATION', question: "Le propriétaire doit-il accepter ma réservation ?", answer: "Non. La réservation est instantanée : dès que votre paiement est accepté, elle est confirmée et vous recevez un e-mail de confirmation. Le propriétaire en est informé aussitôt." },
    { category: 'RESERVATION', question: "Qu’est-ce que la réservation récurrente ?", answer: "Elle permet de réserver en une seule fois plusieurs séjours répartis dans le temps, par exemple une semaine par mois pour un stage ou une alternance. Tous les séjours sont réservés et leurs prix fixés dès le départ. Vous ne payez que le premier ; les suivants sont prélevés automatiquement sur la même carte un mois avant chaque arrivée, après un rappel par e-mail trois jours avant." },
    { category: 'RESERVATION', question: "Puis-je annuler ma réservation ?", answer: "Oui, depuis « Mes séjours ». Vous êtes remboursé à 100 % si vous annulez au moins 30 jours avant l’arrivée, à 50 % entre 14 et 29 jours, et pas en dessous. Dans une réservation récurrente, un séjour pas encore prélevé s’annule sans frais. Il n’y a pas de droit de rétractation pour un hébergement à dates fixes." },
    { category: 'RESERVATION', question: "Que se passe-t-il si le propriétaire annule ?", answer: "Un propriétaire ne peut annuler seul qu’au moins 30 jours avant votre arrivée, et vous êtes alors remboursé intégralement. Plus tard, seule Haven peut annuler, pour un motif sérieux, avec un remboursement intégral et notre aide pour trouver une autre solution." },
    { category: 'PAYMENT', question: "Combien coûte un séjour ?", answer: "Le prix affiché avant de payer comprend tout : le prix des nuits fixé par le propriétaire, un forfait ménage par séjour et les frais de service Haven, égaux à 15 % du prix des nuits. Il n’y a aucun frais caché ni dépôt de garantie à ce jour." },
    { category: 'PAYMENT', question: "Comment se fait le paiement ?", answer: "Par carte bancaire, sur la page sécurisée de Stripe, notre prestataire de paiement. Haven ne voit jamais votre numéro de carte. Une réservation non payée est libérée au bout de 30 minutes." },
    { category: 'PAYMENT', question: "Que se passe-t-il si un prélèvement automatique échoue ?", answer: "Vous êtes prévenu par e-mail et pouvez payer le séjour depuis votre espace. Une nouvelle tentative a lieu 48 heures plus tard. Sans paiement 5 jours après la date prévue, ce seul séjour est annulé ; les autres séjours de votre série sont maintenus." },
    { category: 'PAYMENT', question: "Quand le propriétaire est-il payé ?", answer: "Haven conserve votre paiement jusqu’à votre arrivée. La part du propriétaire (nuits et ménage) lui est versée après votre état des lieux d’entrée. En cas de problème signalé, Haven peut suspendre ce versement le temps de l’examiner." },
    { category: 'INVENTORY', question: "Quand vais-je recevoir l’adresse et les codes d’accès ?", answer: "Les consignes d’entrée (adresse exacte, accès, clés ou code, repères de votre chambre) vous sont envoyées 72 heures avant votre arrivée, ou dès la confirmation si vous réservez à la dernière minute. Elles sont aussi disponibles dans « Mes séjours »." },
    { category: 'INVENTORY', question: "Comment se passe l’état des lieux d’entrée ?", answer: "Le jour de votre arrivée, à partir de l’heure d’arrivée, vous le réalisez depuis « Mes séjours » : quelques photos et un constat de votre chambre et des parties communes. Signalez-y toute anomalie : une fois validé, il fait foi et ne peut plus être modifié." },
    { category: 'INVENTORY', question: "Qui fait le ménage ?", answer: "Le ménage est partagé. Le propriétaire fait réaliser un ménage des parties communes au moins une fois par semaine ; le forfait ménage payé à la réservation y contribue. Pendant votre séjour, vous rangez et nettoyez derrière vous (vaisselle, cuisine, salle de bain, poubelles). Avant de partir, vous laissez votre chambre propre et vide, avec la parure de lit dans le sac prévu, et les espaces communs que vous avez utilisés en ordre." },
    { category: 'INVENTORY', question: "Et l’état des lieux de sortie ?", answer: "Le jour de votre départ, avant l’heure indiquée sur l’annonce, il vous guide point par point : ménage de votre chambre et des espaces utilisés, affaires et aliments retirés, équipements éteints, clés déposées. Vous ajoutez quelques photos (chambre, cuisine, parties communes, salle de bain, clés). Si vous partez plus tôt que prévu, vous pouvez le réaliser dès votre départ ; les nuits non utilisées ne sont pas remboursées." },
    { category: 'INVENTORY', question: "Que faire en cas de problème pendant le séjour ?", answer: "Utilisez « Incident / signalement » dans « Mes séjours », avec une description et une photo si possible. Le propriétaire est prévenu et doit y répondre rapidement. Si le problème n’est pas résolu ou s’il est grave, vous pouvez demander l’intervention de Haven." },
    { category: 'HOUSING', question: "Les logements sont-ils vérifiés ?", answer: "Oui. Chaque annonce est examinée par Haven avant sa mise en ligne, et à nouveau dès que ses textes, ses photos ou son adresse changent. Les propriétaires s’engagent à respecter le cahier des charges Haven : logement propre et en bon état, cuisine équipée, chambre meublée avec lit, rangement et bureau, ménage des parties communes chaque semaine." },
    { category: 'HOUSING', question: "Avec qui vais-je partager le logement ?", answer: "La fiche du logement indique les colocataires déjà confirmés aux mêmes dates, avec un aperçu de leur profil. Tous les membres de Haven ont un compte vérifié." },
    { category: 'HOUSING', question: "Puis-je laisser un avis ?", answer: "Oui. À la fin du séjour, locataire et propriétaire disposent de 7 jours pour se laisser un avis. Seuls les membres ayant réellement séjourné peuvent noter un logement, et les avis ne sont ni payés ni triés selon leur note." },
    { category: 'HOUSING', question: "Je suis propriétaire : comment proposer mon logement ?", answer: "Créez votre compte, faites-le vérifier, configurez vos versements avec Stripe (identité et compte bancaire), puis publiez votre annonce depuis « Ajouter un logement ». Haven la vérifie avant sa mise en ligne. Vous fixez vos prix, votre forfait ménage, votre nombre minimum de nuits et vos disponibilités." },
  ];

  const filteredFaqs = faqItems.filter(item => {
    const matchesSearch = item.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'ALL' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = [
    { id: 'ALL', label: 'Toutes les questions' },
    { id: 'RESERVATION', label: 'Réservations' },
    { id: 'PAYMENT', label: 'Prix et paiements' },
    { id: 'INVENTORY', label: 'Pendant le séjour' },
    { id: 'HOUSING', label: 'Logements' }
  ];

  const toggleExpand = (idx: number) => {
    if (expandedIndex === idx) {
      setExpandedIndex(null);
    } else {
      setExpandedIndex(idx);
    }
  };

  return (
    <div className="bg-haven-cream min-h-screen py-8 sm:py-16 px-4 sm:px-6 lg:px-8 mt-4 sm:mt-12 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        
        {/* Banner Section */}
        <div className="text-center mb-6 sm:mb-12">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">
            Foire aux questions
          </span>
          <h1 className="text-[1.75rem] sm:text-4xl font-heading font-black text-haven-navy mt-4 mb-4">
            Comment pouvons-nous vous aider ?
          </h1>
          <p className="text-gray-500 text-sm max-w-xl mx-auto font-medium">
            Réservation, prix, paiements, séjour et logements : les réponses aux questions les plus fréquentes.
          </p>
        </div>

        {/* Live Search Inputs */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-card flex items-center gap-3 max-w-xl mx-auto mb-6 sm:mb-10">
          <Search className="text-gray-400 shrink-0" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher une question (ex. : annulation, paiement, état des lieux…)"
            className="w-full text-sm font-bold text-haven-navy focus:outline-none placeholder-gray-400 bg-transparent"
          />
        </div>

        {/* Quick Filtering tabs */}
        <div className="flex flex-wrap gap-2 justify-center mb-6 sm:mb-10">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id as any);
                setExpandedIndex(null);
              }}
              className={`py-2 px-4 rounded-full text-xs font-bold transition-all ${
                activeCategory === cat.id
                  ? 'bg-haven-navy text-white shadow-sm'
                  : 'bg-white text-gray-500 hover:text-haven-navy border border-gray-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Accordions Listing */}
        <div className="space-y-4 mb-8 sm:mb-16">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq, idx) => {
              const isExpanded = expandedIndex === idx;
              return (
                <div 
                  key={idx} 
                  className={`bg-white rounded-3xl border border-gray-100 shadow-card transition-all overflow-hidden ${
                    isExpanded ? 'ring-2 ring-haven-navy/10' : ''
                  }`}
                >
                  <button
                    onClick={() => toggleExpand(idx)}
                    className="w-full p-6 text-left flex justify-between items-center gap-4 hover:bg-gray-50/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <HelpCircle size={18} className="text-haven-red shrink-0" />
                      <span className="text-sm font-bold text-haven-navy pr-4">{faq.question}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={18} className="text-haven-navy shrink-0" />
                    ) : (
                      <ChevronDown size={18} className="text-haven-navy shrink-0" />
                    )}
                  </button>

                  <div 
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      isExpanded ? 'max-h-96' : 'max-h-0'
                    }`}
                  >
                    <div className="p-6 pt-0 border-t border-gray-50/50 text-xs font-semibold text-gray-500 leading-relaxed bg-gray-50/30">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 text-gray-400 font-bold">
              Aucune question ne correspond à votre recherche.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
