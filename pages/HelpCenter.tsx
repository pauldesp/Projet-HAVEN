import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen, User, CreditCard, Compass, MapPin, ClipboardCheck, Mail, MessageSquare, ArrowRight, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface HelpArticle {
  id: string;
  title: string;
  excerpt: string;
  category: 'START' | 'FLATMATE' | 'BOOKING' | 'CHECKIN' | 'OWNER';
  content: string;
}

export const HelpCenter: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'START' | 'FLATMATE' | 'BOOKING' | 'CHECKIN' | 'OWNER'>('ALL');
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);

  const categories = [
    { id: 'ALL', label: 'Tout voir', icon: BookOpen },
    { id: 'START', label: 'Premiers pas', icon: Compass },
    { id: 'FLATMATE', label: 'Compte et colocation', icon: User },
    { id: 'BOOKING', label: 'Réservation et paiement', icon: CreditCard },
    { id: 'CHECKIN', label: 'Pendant le séjour', icon: ClipboardCheck },
    { id: 'OWNER', label: 'Espace propriétaire', icon: MapPin }
  ];

  const articles: HelpArticle[] = [
    { id: 'art-1', category: 'START', title: "Comment fonctionne Haven ?", excerpt: "Une plateforme de colocation vérifiée, pour quelques nuits comme pour plusieurs mois.", content: "Haven met en relation des propriétaires de chambres meublées en colocation et des locataires vérifiés : étudiants, stagiaires, alternants, jeunes actifs. Vous cherchez par ville et par dates, réservez et payez en ligne, recevez vos consignes d’accès 72 heures avant l’arrivée, puis réalisez l’état des lieux d’entrée depuis votre téléphone. Haven vérifie les membres et les annonces, encaisse le paiement et ne verse le propriétaire qu’après votre arrivée." },
    { id: 'art-2', category: 'START', title: "Combien de temps puis-je rester ?", excerpt: "De quelques nuits à plusieurs mois, selon le minimum fixé par chaque logement.", content: "Chaque logement indique un nombre minimum de nuits. Il n’y a pas de durée maximale. Si vous avez besoin d’un logement à plusieurs périodes de l’année (stage, alternance, missions), utilisez la recherche récurrente : vous réservez toutes vos périodes en une fois, au même prix." },
    { id: 'art-3', category: 'FLATMATE', title: "Comment faire vérifier mon compte ?", excerpt: "Une pièce d’identité et un justificatif de domicile, à transmettre une seule fois.", content: "Après votre inscription, ouvrez « Mon compte » : complétez vos informations, ajoutez une pièce d’identité et un justificatif de domicile, acceptez les conditions générales, puis envoyez votre dossier. L’équipe Haven le vérifie manuellement et vous prévient par e-mail. Une fois votre compte validé, vous pouvez réserver directement, sans attendre l’accord du propriétaire. Ces justificatifs ne figurent jamais sur votre profil public." },
    { id: 'art-4', category: 'FLATMATE', title: "Les animaux, le tabac ou les invités sont-ils acceptés ?", excerpt: "Chaque logement a ses propres règles, indiquées sur sa fiche.", content: "Les règles de la maison (animaux, tabac, invités, horaires) sont fixées par le propriétaire et indiquées sur la fiche du logement. Vous les acceptez en réservant ; elles vous sont rappelées dans la confirmation. En cas de doute, posez la question au propriétaire depuis la messagerie avant de réserver." },
    { id: 'art-5', category: 'BOOKING', title: "Quand suis-je débité ?", excerpt: "Au moment de la réservation, ou un mois avant chaque séjour pour une série.", content: "Pour un séjour simple, vous payez la totalité au moment de réserver : la réservation est confirmée dès que le paiement est accepté. Pour une réservation récurrente, seul le premier séjour est payé à la réservation ; les suivants sont prélevés automatiquement sur la même carte un mois avant chaque arrivée, après un rappel par e-mail trois jours avant. Haven conserve le paiement et ne verse le propriétaire qu’après votre arrivée." },
    { id: 'art-6', category: 'BOOKING', title: "Une caution ou une empreinte bancaire est-elle demandée ?", excerpt: "Non, aucune caution n’est demandée aujourd’hui.", content: "Aucune caution ni empreinte bancaire n’est demandée sur Haven à ce jour. Si cela change, le montant et les conditions vous seront présentés avant toute réservation. Vous restez responsable des dégradations causées pendant votre séjour ; les états des lieux d’entrée et de sortie servent de référence." },
    { id: 'art-9', category: 'BOOKING', title: "Comment annuler une réservation ?", excerpt: "Depuis « Mes séjours » : remboursement selon le délai avant l’arrivée.", content: "Ouvrez « Mes séjours » et choisissez « Annuler ce séjour ». Vous êtes remboursé à 100 % si vous annulez au moins 30 jours avant l’arrivée, à 50 % entre 14 et 29 jours, et pas en dessous. Un séjour d’une série pas encore prélevé s’annule sans frais. Le remboursement arrive sur votre carte sous 5 à 10 jours selon votre banque." },
    { id: 'art-7', category: 'CHECKIN', title: "Comment réaliser l’état des lieux ?", excerpt: "Quelques photos et un constat, depuis votre téléphone, à l’arrivée et au départ.", content: "Le jour de votre arrivée, à partir de l’heure d’arrivée, ouvrez « Mes séjours » puis « État des lieux d’entrée » : vous passez en revue votre chambre et les parties communes, ajoutez des photos et signalez toute anomalie. Une fois validé, il ne peut plus être modifié et fait foi en cas de désaccord. Le jour du départ, vous faites de même avec l’état des lieux de sortie." },
    { id: 'art-10', category: 'CHECKIN', title: "Un problème pendant le séjour ?", excerpt: "Signalez-le depuis « Mes séjours » : le propriétaire, puis Haven si besoin.", content: "Choisissez « Incident / signalement » sur votre séjour, décrivez le problème et ajoutez une photo si possible. Le propriétaire est prévenu et doit vous répondre rapidement. Si le problème n’est pas résolu, ou s’il est grave, vous pouvez demander l’intervention de Haven, qui peut proposer une solution, un remboursement ou une annulation." },
    { id: 'art-8', category: 'OWNER', title: "Combien coûte la publication d’une annonce ?", excerpt: "La publication est gratuite et aucune commission n’est prise sur vos revenus.", content: "Publier une annonce est gratuit. Vous recevez l’intégralité du prix des nuits et du forfait ménage que vous fixez : les frais de service Haven (15 % du prix des nuits) sont payés par le locataire, et Haven prend en charge les frais bancaires. Votre part est versée après l’arrivée de chaque locataire, sur le compte bancaire enregistré dans votre espace de versement Stripe." },
    { id: 'art-11', category: 'OWNER', title: "Comment publier mon logement ?", excerpt: "Compte vérifié, versements configurés, puis annonce vérifiée par Haven.", content: "Faites d’abord vérifier votre compte, puis configurez vos versements avec Stripe (identité et compte bancaire). Depuis votre espace propriétaire, choisissez « Ajouter un logement » : décrivez le logement et chaque chambre, ajoutez vos photos, fixez vos prix, votre forfait ménage, votre nombre minimum de nuits et vos consignes d’accès. Haven vérifie l’annonce avant sa mise en ligne, et à nouveau si vous modifiez ses textes, ses photos ou son adresse." },
  ];

  const filteredArticles = articles.filter(art => {
    const matchesSearch = art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          art.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          art.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'ALL' || art.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-haven-cream min-h-screen py-8 sm:py-16 px-4 sm:px-6 lg:px-8 mt-4 sm:mt-12 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6 sm:mb-12">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">
            Centre d’aide
          </span>
          <h1 className="text-[1.75rem] sm:text-4xl font-heading font-black text-haven-navy mt-4 mb-4">
            Comment pouvons-nous vous aider ?
          </h1>
          <p className="text-gray-500 text-sm max-w-xl mx-auto font-medium">
            Cherchez un mot-clé ou choisissez un thème pour trouver nos guides pas à pas.
          </p>
        </div>

        {/* Global Search Bar */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-card flex items-center gap-3 max-w-xl mx-auto mb-6 sm:mb-12">
          <Search className="text-gray-400 shrink-0" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setSelectedArticle(null); // clear article view on search
            }}
            placeholder="Rechercher un guide (ex. : annulation, paiement, état des lieux…)"
            className="w-full text-sm font-bold text-haven-navy focus:outline-none placeholder-gray-400 bg-transparent"
          />
        </div>

        {/* Category Icons Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6 sm:mb-10">
          {categories.map(cat => {
            const IconComp = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id as any);
                  setSelectedArticle(null);
                }}
                className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-2.5 cursor-pointer ${
                  isActive 
                    ? 'bg-haven-navy border-haven-navy text-white shadow-sm'
                    : 'bg-white border-gray-100 text-gray-550 hover:border-gray-200 hover:text-haven-navy'
                }`}
              >
                <IconComp size={20} className={isActive ? 'text-haven-red' : 'text-gray-400'} />
                <span className="text-[10px] font-bold leading-normal">{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Display Area */}
        {selectedArticle ? (
          /* Detailed view of an article */
          <div className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-12 border border-gray-100 shadow-premium mb-6 sm:mb-12 animate-fade-in">
            <button
              onClick={() => setSelectedArticle(null)}
              className="inline-flex items-center gap-1 text-xs font-black text-gray-400 hover:text-haven-navy uppercase tracking-wider mb-6 cursor-pointer"
            >
              <ArrowRight size={14} className="rotate-180" />
              <span>Retour à l'aide</span>
            </button>

            <span className="px-3 py-1 bg-haven-navy/5 text-haven-navy text-[10px] font-black uppercase rounded-full tracking-wider">
              {categories.find(c => c.id === selectedArticle.category)?.label}
            </span>

            <h2 className="text-2xl sm:text-3xl font-heading font-black text-haven-navy mt-4 mb-6">
              {selectedArticle.title}
            </h2>

            <div className="text-gray-600 font-semibold text-sm sm:text-base leading-relaxed space-y-4 pt-4 border-t border-gray-50">
              {selectedArticle.content.split('\n').map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-gray-450 font-bold">Cet article vous a-t-il été utile ?</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    toast.success("Merci pour votre retour !");
                    setSelectedArticle(null);
                  }}
                  className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-600 rounded-lg"
                >
                  Oui, tout à fait !
                </button>
                <button
                  onClick={() => {
                    toast.success("Désolé. Notre service d'assistance de messagerie prend le relais !");
                    navigate('/contact');
                  }}
                  className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-600 rounded-lg"
                >
                  Non, pas vraiment
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* List of matching articles */
          <div className="space-y-4 mb-8 sm:mb-16">
            {filteredArticles.length > 0 ? (
              filteredArticles.map((art) => (
                <div 
                  key={art.id}
                  onClick={() => setSelectedArticle(art)}
                  className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-card hover:shadow-premium hover:border-gray-200 transition-all cursor-pointer flex items-center justify-between gap-4 group"
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <span className="text-[10px] uppercase font-black tracking-wider text-haven-red">
                      {categories.find(c => c.id === art.category)?.label}
                    </span>
                    <h3 className="text-base sm:text-lg font-heading font-black text-haven-navy group-hover:text-haven-navy/80 transition-colors">
                      {art.title}
                    </h3>
                    <p className="text-xs text-gray-400 font-medium">
                      {art.excerpt}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0 group-hover:bg-haven-navy/5 text-haven-navy transition-all">
                    <ChevronRight size={16} />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 text-gray-400 font-bold">
                Aucun guide ne répond à votre recherche. Essayez avec un autre mot-clé.
              </div>
            )}
          </div>
        )}

        {/* Direct messaging / Support box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          
          <div className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-8 border border-gray-100 shadow-premium flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                <MessageSquare size={20} />
              </div>
              <h3 className="font-heading font-black text-lg text-haven-navy">Questions fréquentes</h3>
              <p className="text-xs text-gray-400 leading-relaxed font-semibold">
                D’autres questions sur la réservation, les paiements ou le séjour ? Consultez notre FAQ.
              </p>
            </div>
            <div className="pt-6">
              <button
                onClick={() => navigate('/faq')}
                className="text-xs font-black uppercase text-violet-600 hover:text-violet-700 tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <span>Aller sur la FAQ</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[1.75rem] sm:rounded-[2.5rem] p-5 sm:p-8 border border-gray-100 shadow-premium flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-haven-red/5 text-haven-red flex items-center justify-center">
                <Mail size={20} />
              </div>
              <h3 className="font-heading font-black text-lg text-haven-navy">Besoin d’aide ?</h3>
              <p className="text-xs text-gray-400 leading-relaxed font-semibold">
                Écrivez à l’équipe Haven depuis la page Contact : nous vous répondons par e-mail dans les meilleurs délais.
              </p>
            </div>
            <div className="pt-6">
              <button
                onClick={() => navigate('/contact')}
                className="text-xs font-black uppercase text-haven-red hover:text-red-700 tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <span>Envoyer un message</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
