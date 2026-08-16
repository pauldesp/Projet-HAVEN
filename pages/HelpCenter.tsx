import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  BookOpen, 
  User, 
  CreditCard, 
  Compass, 
  MapPin, 
  ClipboardCheck, 
  Mail, 
  MessageSquare, 
  ArrowRight,
  ChevronRight,
  HelpCircle
} from 'lucide-react';
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
    { id: 'FLATMATE', label: 'Profil & Colocataires', icon: User },
    { id: 'BOOKING', label: 'Réservation & Stripe', icon: CreditCard },
    { id: 'CHECKIN', label: 'États des lieux', icon: ClipboardCheck },
    { id: 'OWNER', label: 'Espace Propriétaire', icon: MapPin }
  ];

  const articles: HelpArticle[] = [
    {
      id: 'art-1',
      category: 'START',
      title: "Comment fonctionne globalement HAVEN ?",
      excerpt: "Découvrez notre plateforme de colocation de moyenne et courte durée meublée et flexible.",
      content: "HAVEN est une plateforme qui simplifie la colocation de courte durée (séjours de 1 à 12 mois). Les locataires peuvent parcourir des appartements meublés de standing, réserver en ligne via Stripe en validant les conditions et en effectuant leur paiement (ce qui vaut contrat tripartite exécutoire entre le locataire, le propriétaire et HAVEN), puis effectuer de manière autonome leur état des lieux d'entrée et de sortie sur leur smartphone."
    },
    {
      id: 'art-2',
      category: 'START',
      title: "Puis-je louer pour seulement quelques mois ?",
      excerpt: "Oui ! HAVEN est conçu spécialement pour les séjours flexibles destinés aux étudiants et jeunes actifs.",
      content: "La durée de location est totalement modulable selon les besoins de votre stage, alternance ou mission professionnelle, généralement de 1 à 12 mois. Vous choisissez vos dates de début et de fin directement depuis l'annonce du logement."
    },
    {
      id: 'art-3',
      category: 'FLATMATE',
      title: "Comment postuler à une colocation ?",
      excerpt: "Remplissez votre profil en quelques minutes pour présenter votre candidature de manière authentique.",
      content: "Il vous suffit de créer un compte locataire, d'indiquer votre situation actuelle (étudiant, stagiaire, jeune pro), de rédiger une brève présentation sympathique et de soumettre vos dates souhaitées. La réservation et le paiement valent contrat de colocation tripartite dès validation."
    },
    {
      id: 'art-4',
      category: 'FLATMATE',
      title: "Les animaux de compagnie sont-ils acceptés ?",
      excerpt: "Consultez le règlement de la colocation pour connaître les autorisations de chaque logement.",
      content: "Chaque appartement dispose de son propre règlement d'usage défini par le propriétaire. Vous retrouverez cette mention dans la section 'Caractéristiques' de l'annonce ou dans le règlement intérieur joint au contrat."
    },
    {
      id: 'art-5',
      category: 'BOOKING',
      title: "Quand s'effectue le prélèvement du premier loyer ?",
      excerpt: "Comprendre le calendrier de paiement Stripe et la sécurité des fonds déposés en ligne.",
      content: "Le premier mois de loyer et la commission de 15% ne sont prélevés que lorsque le propriétaire approuve officiellement votre demande de réservation. L'argent est conservé de manière sécurisée par Stripe et uniquement reversé après validation de l'état des lieux d'entrée."
    },
    {
      id: 'art-6',
      category: 'BOOKING',
      title: "Comment récupérer mon dépôt de garantie (caution) ?",
      excerpt: "Détails sur les modalités et délais légaux de restitution de votre dépôt après le départ.",
      content: "Après validation de l'état des lieux de sortie autonome (check-out) par vous-même et le propriétaire, votre dépôt de garantie vous est restitué automatiquement sous 14 jours si aucun dégât n'a été constaté ou signalé."
    },
    {
      id: 'art-7',
      category: 'CHECKIN',
      title: "Qu'est-ce que l'état des lieux numérique autonome ?",
      excerpt: "Apprenez à utiliser l'application pour réaliser vos check-in et check-out officiels de manière infalsifiable.",
      content: "Il s'agit d'un formulaire juridique interactif accessible directement sur l'application HAVEN le jour d'entrée. Étape par étape, vous passez en revue les piéces du logement, déclarez l'état du mobilier et signez sur votre écran tactile. Ce document numérique infalsifiable fait juridiquement foi."
    },
    {
      id: 'art-8',
      category: 'OWNER',
      title: "Combien cela coûte-t-il de publier une annonce ?",
      excerpt: "La publication d'annonces est gratuite pour tous les propriétaires particuliers de la plateforme.",
      content: "La création et la diffusion de votre annonce de colocation sont entièrement gratuites. HAVEN applique uniquement des frais de service de 15% sur les loyers collectés auprès du locataire pour l'utilisation et la mise en œuvre de l'accord tripartite, des outils d'état des lieux numériques."
    }
  ];

  const filteredArticles = articles.filter(art => {
    const matchesSearch = art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          art.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          art.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'ALL' || art.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-haven-cream min-h-screen py-16 px-4 sm:px-6 lg:px-8 mt-12 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-12">
          <span className="px-4 py-1.5 bg-haven-navy/5 text-haven-navy rounded-full text-xs font-black uppercase tracking-widest">
            Centre d'aide & Documentation
          </span>
          <h1 className="text-4xl font-heading font-black text-haven-navy mt-4 mb-4">
            Comment pouvons-nous vous aider ?
          </h1>
          <p className="text-gray-500 text-sm max-w-xl mx-auto font-medium">
            Entrez un mot-clé ou sélectionnez une thématique pour découvrir en quelques secondes nos guides d'utilisation pas-à-pas.
          </p>
        </div>

        {/* Global Search Bar */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-card flex items-center gap-3 max-w-xl mx-auto mb-12">
          <Search className="text-gray-400 shrink-0" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setSelectedArticle(null); // clear article view on search
            }}
            placeholder="Rechercher un article, un guide (ex: Stripe, bail, caution...)"
            className="w-full text-sm font-bold text-haven-navy focus:outline-none placeholder-gray-400 bg-transparent"
          />
        </div>

        {/* Category Icons Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-10">
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
          <div className="bg-white rounded-[2.5rem] p-8 sm:p-12 border border-gray-100 shadow-premium mb-12 animate-fade-in">
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
          <div className="space-y-4 mb-16">
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
          
          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-premium flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                <MessageSquare size={20} />
              </div>
              <h3 className="font-heading font-black text-lg text-haven-navy">Foire Aux Questions</h3>
              <p className="text-xs text-gray-400 leading-relaxed font-semibold">
                Vous préférez consulter des informations ciblées sur l'état des lieux autonome, les clés sécurisées et les baux juridiques ? Rendez-vous sur notre FAQ complète.
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

          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-premium flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-haven-red/5 text-haven-red flex items-center justify-center">
                <Mail size={20} />
              </div>
              <h3 className="font-heading font-black text-lg text-haven-navy">Toujours bloqué ?</h3>
              <p className="text-xs text-gray-400 leading-relaxed font-semibold">
                Notre équipe de support client HAVEN se tient à votre entière disposition 7j/7 pour lever tous vos doutes sur vos colocations ou l'état de l'application.
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
