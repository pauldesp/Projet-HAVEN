
import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Calendar as CalendarIcon, ShieldCheck, Sparkles, TrendingUp, BarChart3, AlertCircle, Users, Route, Info } from 'lucide-react';
import { Button } from '../components/Button';
import { HomeSearchPreview } from '../components/HomeSearchPreview';
import { Logo } from '../components/Logo';
import { HavenPhotoBackground } from '../components/HavenPhotoBackground';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const searchRef = useRef<HTMLDivElement>(null);
  const [recurringRequest, setRecurringRequest] = useState(0);

  const handleRecurringClick = () => {
    setRecurringRequest(count => count + 1);
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const { currentUser } = useAuth();
  
  const handlePublishClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUser) {
      navigate('/login?redirect=/owner/publish&role=OWNER');
    } else if (currentUser.role !== UserRole.OWNER && currentUser.role !== UserRole.ADMIN) {
      navigate('/login?redirect=/owner/publish&role=OWNER');
    } else {
      navigate('/owner/publish');
    }
  };

  return (
    <div className="w-full bg-haven-cream font-body selection:bg-haven-navy/10">
      {/* Refined Minimalist Hero */}
      <div className="home-search-hero relative flex min-h-[680px] w-full flex-col items-center px-4 py-10 md:py-16">
        
        {/* Background */}
        <div className="home-search-backdrop" aria-hidden="true">
          <div className="home-search-backdrop-frame"><HavenPhotoBackground /></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 w-full max-w-4xl text-center space-y-6 animate-fade-in">
          <div className="space-y-4">
            <h1 className="font-heading font-medium text-[2rem] md:text-4xl lg:text-5xl text-white leading-[1.1] tracking-tight drop-shadow-2xl">
              {t('hero.title')}
            </h1>
            
            <p className="text-sm md:text-base text-white/85 max-w-xl mx-auto font-light leading-relaxed drop-shadow-md px-4">
              {t('hero.subtitle')}
            </p>
          </div>

          <div ref={searchRef} className="pt-3 md:pt-5 w-full scroll-mt-20">
            <HomeSearchPreview recurringRequest={recurringRequest} />
          </div>
        </div>
      </div>

      <div>
      {/* Value Props Section */}
      <section className="py-8 sm:py-12 md:py-24 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-3 gap-5 sm:gap-12 lg:gap-20">
          <div className="flex items-center gap-4 sm:block sm:space-y-8">
            <div className="shrink-0 w-10 h-10 sm:w-16 sm:h-16 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl sm:rounded-[22px] transition-transform duration-300 hover:scale-110">
              <CalendarIcon size={32} strokeWidth={1.5} className="w-5 h-5 sm:w-8 sm:h-8" />
            </div>
            <div className="min-w-0 space-y-1 sm:space-y-4">
              <h3 className="font-heading font-bold text-lg sm:text-2xl text-haven-navy tracking-tight">{t('value.flexibility.title')}</h3>
              <p className="text-haven-stone text-[13px] sm:text-sm leading-snug sm:leading-relaxed antialiased font-medium opacity-90">
                {t('value.flexibility.desc')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 sm:block sm:space-y-8">
            <div className="shrink-0 w-10 h-10 sm:w-16 sm:h-16 flex items-center justify-center bg-red-50 text-haven-red rounded-xl sm:rounded-[22px] transition-transform duration-300 hover:scale-110">
              <ShieldCheck size={32} strokeWidth={1.5} className="w-5 h-5 sm:w-8 sm:h-8" />
            </div>
            <div className="min-w-0 space-y-1 sm:space-y-4">
              <h3 className="font-heading font-bold text-lg sm:text-2xl text-haven-navy tracking-tight">{t('value.community.title')}</h3>
              <p className="text-haven-stone text-[13px] sm:text-sm leading-snug sm:leading-relaxed antialiased font-medium opacity-90">
                {t('value.community.desc')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 sm:block sm:space-y-8">
            <div className="shrink-0 w-10 h-10 sm:w-16 sm:h-16 flex items-center justify-center bg-green-50 text-green-600 rounded-xl sm:rounded-[22px] transition-transform duration-300 hover:scale-110">
              <Sparkles size={32} strokeWidth={1.5} className="w-5 h-5 sm:w-8 sm:h-8" />
            </div>
            <div className="min-w-0 space-y-1 sm:space-y-4">
              <h3 className="font-heading font-bold text-lg sm:text-2xl text-haven-navy tracking-tight">{t('value.ready.title')}</h3>
              <p className="text-haven-stone text-[13px] sm:text-sm leading-snug sm:leading-relaxed antialiased font-medium opacity-90">
                {t('value.ready.desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MARKET STATS SECTION */}
      <section className="bg-haven-gray/50 py-8 sm:py-12 md:py-24 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mb-6 sm:mb-16 space-y-2 sm:space-y-4">
            <h2 className="font-heading font-bold text-2xl sm:text-3xl md:text-4xl text-haven-navy leading-tight">
              {t('stats.title')}
            </h2>
            <p className="text-haven-stone text-sm sm:text-lg font-light leading-relaxed">
              {t('stats.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-8">
            <div className="flex items-center gap-4 sm:block bg-white p-5 sm:p-6 md:p-10 rounded-[1.75rem] sm:rounded-[2.5rem] shadow-soft border border-gray-100 hover:shadow-premium transition-all duration-500 group">
              <div className="shrink-0 sm:mb-6 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-haven-red/5 text-haven-red flex items-center justify-center group-hover:bg-haven-red group-hover:text-white transition-colors">
                <AlertCircle size={24} />
              </div>
              <div className="min-w-0 space-y-1 sm:space-y-3">
                <span className="block font-heading font-bold text-3xl sm:text-5xl text-haven-navy tracking-tight">{t('stats.stat1.val')}</span>
                <p className="text-[13px] sm:text-sm text-haven-stone leading-snug sm:leading-relaxed font-medium">{t('stats.stat1.label')}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:block bg-white p-5 sm:p-6 md:p-10 rounded-[1.75rem] sm:rounded-[2.5rem] shadow-soft border border-gray-100 hover:shadow-premium transition-all duration-500 group">
              <div className="shrink-0 sm:mb-6 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Route size={24} />
              </div>
              <div className="min-w-0 space-y-1 sm:space-y-3">
                <span className="block font-heading font-bold text-3xl sm:text-5xl text-haven-navy tracking-tight">{t('stats.stat2.val')}</span>
                <p className="text-[13px] sm:text-sm text-haven-stone leading-snug sm:leading-relaxed font-medium">{t('stats.stat2.label')}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:block bg-white p-5 sm:p-6 md:p-10 rounded-[1.75rem] sm:rounded-[2.5rem] shadow-soft border border-gray-100 hover:shadow-premium transition-all duration-500 group">
              <div className="shrink-0 sm:mb-6 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <BarChart3 size={24} />
              </div>
              <div className="min-w-0 space-y-1 sm:space-y-3">
                <span className="block font-heading font-bold text-3xl sm:text-5xl text-haven-navy tracking-tight">{t('stats.stat3.val')}</span>
                <p className="text-[13px] sm:text-sm text-haven-stone leading-snug sm:leading-relaxed font-medium">{t('stats.stat3.label')}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 sm:block bg-white p-5 sm:p-6 md:p-10 rounded-[1.75rem] sm:rounded-[2.5rem] shadow-soft border border-gray-100 hover:shadow-premium transition-all duration-500 group">
              <div className="shrink-0 sm:mb-6 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
                <Users size={24} />
              </div>
              <div className="min-w-0 space-y-1 sm:space-y-3">
                <span className="block font-heading font-bold text-3xl sm:text-5xl text-haven-navy tracking-tight">{t('stats.stat4.val')}</span>
                <p className="text-[13px] sm:text-sm text-haven-stone leading-snug sm:leading-relaxed font-medium">{t('stats.stat4.label')}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 sm:mt-10 md:mt-14 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6 md:gap-10">
            <p className="text-haven-navy text-sm sm:text-lg md:text-xl font-medium leading-relaxed max-w-3xl">
              {t('stats.recurring.pitch')}
            </p>
            <Button
              size="lg"
              className="w-full md:w-auto shrink-0 bg-haven-navy text-white hover:bg-haven-navy/90 px-6 md:px-8 py-3 sm:py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all text-xs"
              onClick={handleRecurringClick}
            >
              {t('stats.recurring.cta')}
            </Button>
          </div>
        </div>
      </section>

      {/* TENANT COMPARISON SECTION */}
      <section className="py-8 sm:py-12 md:py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 text-center">
          <div className="max-w-4xl mx-auto mb-6 sm:mb-12 space-y-2 sm:space-y-4">
            <h2 className="font-heading font-medium text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-haven-navy leading-tight tracking-tight">
              Le juste prix de la mobilité pour le locataire
            </h2>
            <div className="flex items-center justify-center gap-3 text-haven-stone">
              <div className="shrink-0 w-8 h-8 rounded-full bg-haven-navy/5 flex items-center justify-center">
                <Info size={14} className="text-haven-navy" />
              </div>
              <p className="text-xs font-medium opacity-80">
                Séjour de 5 nuits à La Rochelle, du dimanche 12 au vendredi 17 juillet
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-stretch max-w-6xl mx-auto pt-3 sm:pt-4">
            {/* Hotel Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gray-50/50 rounded-[1.75rem] sm:rounded-[2rem] p-5 sm:p-8 border border-gray-100 flex flex-col items-center justify-center space-y-2 sm:space-y-6 h-full"
            >
              <h3 className="text-lg sm:text-xl font-black text-haven-navy tracking-tight">Hôtel low cost</h3>
              <div className="space-y-1">
                <div className="text-3xl sm:text-5xl font-black text-haven-navy tracking-tighter">260 €</div>
              </div>
              <div className="space-y-1 sm:pt-2">
                <p className="text-[10px] font-bold text-haven-stone uppercase tracking-widest">Ex. : hôtel Première Classe</p>
                <p className="text-[10px] font-medium text-gray-400">WC + SDB sur le palier</p>
              </div>
            </motion.div>

            {/* Airbnb Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-gray-50/50 rounded-[1.75rem] sm:rounded-[2rem] p-5 sm:p-8 border border-gray-100 flex flex-col items-center justify-center space-y-2 sm:space-y-6 h-full"
            >
              <h3 className="text-lg sm:text-xl font-black text-haven-navy tracking-tight">Airbnb</h3>
              <div className="w-full grid grid-cols-2 gap-3 sm:block sm:space-y-4">
                <div className="space-y-0.5">
                  <div className="text-2xl sm:text-3xl font-black text-haven-navy tracking-tighter">280 €</div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight sm:leading-none">studio seul</p>
                </div>
                <div className="hidden sm:block h-px w-8 bg-gray-200 mx-auto"></div>
                <div className="space-y-0.5">
                  <div className="text-2xl sm:text-3xl font-black text-haven-navy tracking-tighter">230 €</div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight sm:leading-none">chambre chez l’habitant</p>
                </div>
              </div>
            </motion.div>

            {/* Haven Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 100 }}
              className="relative rounded-[2rem] bg-white border-2 border-haven-red p-0.5 shadow-2xl flex flex-col items-center h-full group"
            >
              <div className="absolute -top-3.5 bg-haven-red text-white text-[10px] font-black uppercase tracking-[0.15em] px-5 py-1.5 rounded-full shadow-lg z-10 translate-y-0 group-hover:-translate-y-1 transition-transform">
                Le plus avantageux
              </div>
              <div className="flex-1 w-full bg-white rounded-[1.9rem] px-5 pt-6 pb-5 sm:p-8 flex flex-col items-center justify-center space-y-2 sm:space-y-6">
                <Logo className="h-7 sm:h-9" />
                <div className="space-y-1">
                  <div className="text-4xl sm:text-6xl font-black text-haven-red tracking-tighter">175 €</div>
                  <p className="text-[11px] font-black text-haven-navy uppercase tracking-[0.2em]">POUR CE SÉJOUR</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* OWNER YIELD COMPARISON SECTION */}
      <section className="py-8 sm:py-12 md:py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 text-center">
          <div className="max-w-4xl mx-auto mb-6 sm:mb-12 space-y-2 sm:space-y-4">
            <h2 className="font-heading font-medium text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-haven-navy leading-tight tracking-tight">
              Rentabilité propriétaire
            </h2>
            <div className="flex items-center justify-center gap-3 text-haven-stone">
              <div className="shrink-0 w-8 h-8 rounded-full bg-haven-navy/5 flex items-center justify-center">
                <Info size={14} className="text-haven-navy" />
              </div>
              <div className="text-left">
                <p className="text-xs font-medium opacity-80">
                  Exemple : T4 en ville moyenne peu tendue
                </p>
                <p className="text-[11px] font-medium opacity-60">
                  Base : occupation complète
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 items-stretch max-w-6xl mx-auto">
            {/* Basic Furnished Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-[2rem] shadow-premium border border-gray-100 flex flex-col overflow-hidden h-full"
            >
              <div className="bg-haven-navy p-3 sm:p-5 flex items-center justify-center">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">Logement entier meublé</h3>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 space-y-1">
                <div className="text-3xl sm:text-5xl font-black text-haven-navy tracking-tighter">900 €</div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">/ mois</p>
              </div>
            </motion.div>

            {/* Classic Colocation Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-[2rem] shadow-premium border border-gray-100 flex flex-col overflow-hidden h-full"
            >
              <div className="bg-gray-100 p-3 sm:p-5 flex flex-col items-center justify-center">
                <h3 className="text-sm sm:text-base font-bold text-haven-navy tracking-tight text-center">Colocation{' '}<br className="hidden sm:inline"/>classique</h3>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 space-y-1.5 sm:space-y-3">
                <div className="space-y-1">
                  <div className="text-3xl sm:text-5xl font-black text-haven-navy tracking-tighter">1 350 €</div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">/ mois</p>
                </div>
                <div className="h-px w-6 bg-gray-100"></div>
                <p className="text-xs font-bold text-haven-navy tracking-tight">450 € HC / chambre</p>
              </div>
            </motion.div>

            {/* Haven Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 100 }}
              className="relative rounded-[2rem] bg-white border-2 border-haven-red shadow-2xl flex flex-col overflow-hidden h-full scale-[1.02] z-10"
            >
              <div className="bg-haven-red p-3 sm:p-6 flex items-center justify-center">
                <Logo className="h-7 sm:h-10" white />
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 space-y-2 sm:space-y-4">
                <div className="space-y-1">
                  <div className="text-3xl sm:text-5xl font-black text-haven-red tracking-tighter">1 870 €</div>
                  <p className="text-[10px] font-black text-haven-red uppercase tracking-widest leading-none">/ mois</p>
                </div>
                <p className="text-xs font-bold text-haven-red tracking-tight">145 € / semaine par chambre</p>
                
                <div className="w-full sm:pt-2">
                  <div className="bg-haven-red text-white py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-haven-red/20">
                    Solution la plus rentable
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <p className="mt-6 sm:mt-10 md:mt-12 max-w-2xl mx-auto text-haven-stone text-sm sm:text-base md:text-lg font-light leading-relaxed">
            Les locataires récurrents réservent sur plusieurs mois : votre calendrier se remplit plus vite et plus longtemps.
          </p>

          {/* Efficiency Comparison Bar & CTA */}
          <div className="mt-4 sm:mt-6 md:mt-8 flex flex-col md:flex-row items-center justify-center gap-3 sm:gap-6">
            <div className="w-full sm:w-auto inline-flex flex-wrap justify-center items-center gap-x-3 gap-y-1 sm:gap-4 px-4 sm:px-5 md:px-8 py-3 sm:py-4 bg-white border border-haven-red/20 rounded-2xl shadow-lg animate-fade-in">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-haven-red text-white flex items-center justify-center shadow-md shadow-haven-red/10">
                <TrendingUp size={20} className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="flex items-baseline gap-2">
                 <span className="text-2xl sm:text-4xl font-black text-haven-red tracking-tighter">+520 €</span>
                 <span className="text-xs sm:text-sm font-bold text-haven-red opacity-80">/ mois</span>
              </div>
              <div className="h-6 w-px bg-gray-100 hidden md:block mx-2"></div>
              <p className="text-xs font-bold text-haven-stone tracking-tight">
                vs colocation classique
              </p>
            </div>

            <Button 
              size="lg" 
              className="w-full sm:w-auto bg-haven-navy text-white hover:bg-haven-navy/90 px-8 py-3 sm:py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all text-xs h-12 sm:h-[72px]"
              onClick={handlePublishClick}
            >
              Publier un logement
            </Button>
          </div>
        </div>
      </section>

      {/* Final Space between sections */}
      <div className="h-4 sm:h-12"></div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 1s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
      </div>
    </div>
  );
};
