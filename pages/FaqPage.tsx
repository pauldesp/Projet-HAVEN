import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Search, Calendar, ShieldCheck, CreditCard, Star, RefreshCw } from 'lucide-react';

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
    {
      category: 'RESERVATION',
      question: "Quelle est la durée de séjour minimale et maximale ?",
      answer: "HAVEN propose des colocations flexibles pensées pour les séjours de courte durée (généralement de 1 à 12 mois), idéales pour les étudiants, alternants, stagiaires et professionnels en transition. Les dates exactes sont calibrées lors de votre demande de réservation sur la fiche de l'annonce."
    },
    {
      category: 'RESERVATION',
      question: "Comment fonctionne la validation des profils ?",
      answer: "Les propriétaires peuvent consulter le profil de chaque candidat locataire (prénom, âge, statut, présentation personnelle ainsi que les avis laissés par d'autres propriétaires). Les accords de colocation ne sont officiellement confirmés que lorsque le propriétaire approuve activement la demande après paiement."
    },
    {
      category: 'PAYMENT',
      question: "Le paiement en ligne est-il hautement sécurisé ?",
      answer: "Oui, à 100%. Toutes les transactions bancaires (réservations, loyers, frais de service du locataire et versements aux propriétaires) transitent par Stripe, leader mondial du paiement en ligne. HAVEN ne stocke aucune donnée de carte bancaire."
    },
    {
      category: 'PAYMENT',
      question: "Qu'est-ce que les frais de plateforme (Commission de 15%) ?",
      answer: "HAVEN prélève des frais de service de 15% pour couvrir la gestion de la mise en relation et de l'accord tripartite, l'hébergement sécurisé des états des lieux (check-in / check-out) et d'éventuels signalements ou médiations en cas de défaut ou sinistre."
    },
    {
      category: 'INVENTORY',
      question: "Quand puis-je réaliser mon état des lieux d'entrée (Check-in) ?",
      answer: "L'état des lieux d'entrée (Check-in) est accessible uniquement le jour exact du début de votre bail de réservation (date d'entrée définie). Il s'effectue directement sur l'application HAVEN. Pour des raisons d'authenticité juridique, une fois finalisé et validé, le check-in est enregistré comme preuve faisant foi mais ne peut plus être modifié par le locataire."
    },
    {
      category: 'INVENTORY',
      question: "Comment se déroule l'état des lieux de sortie (Check-out) ?",
      answer: "De même que pour l'entrée, le Check-out est accessible uniquement le jour du départ officiel (sauf déverrouillage anticipé approuvé par le propriétaire ou l'administrateur en cas de départ précoce). Une fois soumis par le locataire, il est figé et consultable dans vos archives."
    },
    {
      category: 'HOUSING',
      question: "Qu'est-ce que le cahier des charges d'excellence pour les propriétaires ?",
      answer: "Avant de pouvoir mettre en ligne une annonce, les propriétaires s'engagent à respecter une charte d'équipement stricte (chambre meublée d'au moins 9m², literie de qualité, équipements de cuisine modernes et fonctionnels, connexion Internet haut débit Wi-Fi incluse). C'est le gage de qualité HAVEN."
    },
    {
      category: 'HOUSING',
      question: "Est-il possible de laisser un avis après mon séjour ?",
      answer: "Absolument ! Les locataires et les propriétaires sont invités à se noter mutuellement à la fin du séjour (note globale, propreté, communication). Les avis contribuent à instaurer un climat de confiance solide au sein de la communauté HAVEN."
    }
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
    { id: 'PAYMENT', label: 'Paiements & Stripe' },
    { id: 'INVENTORY', label: 'Check-in / Check-out' },
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
    <div className="bg-haven-cream min-h-screen py-16 px-4 sm:px-6 lg:px-8 mt-12 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        
        {/* Banner Section */}
        <div className="text-center mb-12">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">
            Foire aux questions
          </span>
          <h1 className="text-4xl font-heading font-black text-haven-navy mt-4 mb-4">
            Comment pouvons-nous vous aider ?
          </h1>
          <p className="text-gray-500 text-sm max-w-xl mx-auto font-medium">
            Toutes les réponses à vos questions concernant les réservations en courte durée, la sécurité Stripe, le cahier des charges propriétaire et les états des lieux numériques.
          </p>
        </div>

        {/* Live Search Inputs */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-card flex items-center gap-3 max-w-xl mx-auto mb-10">
          <Search className="text-gray-400 shrink-0" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher une question (ex: Stripe, Check-in, Caution...)"
            className="w-full text-sm font-bold text-haven-navy focus:outline-none placeholder-gray-400 bg-transparent"
          />
        </div>

        {/* Quick Filtering tabs */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
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
        <div className="space-y-4 mb-16">
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
