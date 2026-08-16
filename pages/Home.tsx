
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, Calendar as CalendarIcon, ShieldCheck, Sparkles, TrendingUp, BarChart3, AlertCircle, Users, Route, Check, X, Coins, Hotel, Info, Home as HomeIcon } from 'lucide-react';
import { Button } from '../components/Button';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { DateRangePicker } from '../components/DateRangePicker';
import { Logo } from '../components/Logo';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city) params.append('city', city);
    if (startDate) params.append('start', startDate);
    if (endDate) params.append('end', endDate);
    navigate(`/search?${params.toString()}`);
  };

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
      <div className="relative h-[85vh] min-h-[600px] w-full flex flex-col justify-center items-center px-4 overflow-hidden">
        
        {/* Background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=2070&auto=format&fit=crop" 
            alt="Ambiance colocation HAVEN avec jeunes actifs" 
            className="absolute inset-0 w-full h-full object-cover brightness-[0.42] contrast-[1.05]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-haven-navy/80 via-transparent to-haven-navy/60"></div>
          <div className="absolute inset-0 bg-black/45"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 w-full max-w-4xl text-center space-y-6 animate-fade-in">
          <div className="space-y-4">
            <h1 className="font-heading font-medium text-3xl md:text-4xl lg:text-5xl text-white leading-tight tracking-tight drop-shadow-2xl">
              {t('hero.title')}
            </h1>
            
            <p className="text-sm md:text-base text-white/85 max-w-xl mx-auto font-light leading-relaxed drop-shadow-md px-4">
              {t('hero.subtitle')}
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 pt-8 w-full">
            <form 
              onSubmit={handleSearch} 
              style={{ width: '914px' }}
              className="bg-white p-1.5 rounded-2xl md:rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col md:flex-row items-stretch max-w-full border border-gray-100 relative group/form"
            >
              {/* Where Section */}
              <div className="flex-1 px-8 py-4 w-full border-b md:border-b-0 md:border-r border-gray-100 text-left hover:bg-gray-50/80 transition-colors cursor-pointer rounded-t-2xl md:rounded-l-full md:rounded-tr-none group">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-1.5 group-hover:text-haven-navy transition-colors">{t('search.label_where')}</label>
                <div className="h-8 flex items-center">
                  <CityAutocomplete value={city} onChange={setCity} placeholder={t('search.placeholder_where')} />
                </div>
              </div>

              {/* When Section */}
              <div className="flex-1 px-8 py-4 w-full border-b md:border-b-0 border-gray-100 text-left hover:bg-gray-50/80 transition-colors cursor-pointer md:rounded-none group">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-1.5 group-hover:text-haven-navy transition-colors">{t('search.label_when')}</label>
                <div className="h-8 flex items-center">
                  <DateRangePicker 
                    startDate={startDate}
                    endDate={endDate}
                    onChange={(start, end) => { setStartDate(start); setEndDate(end); }}
                  />
                </div>
              </div>

              {/* Search Button */}
              <div className="px-4 md:pr-6 flex items-center justify-center">
                <button 
                  type="submit" 
                  className="bg-haven-red hover:bg-[#8B3939] text-white h-12 px-8 rounded-xl md:rounded-full transition-all duration-500 font-bold text-sm flex items-center justify-center gap-2 w-full md:w-auto active:scale-[0.97] shadow-lg shadow-haven-red/20 group/btn overflow-hidden relative"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500"></div>
                  <Search size={16} strokeWidth={3} className="relative z-10 group-hover/btn:scale-110 transition-transform duration-500" />
                  <span className="relative z-10 tracking-wide uppercase text-[10px]">{t('search.button')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Value Props Section */}
      <section className="py-24 max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-12 lg:gap-20">
          <div className="space-y-8">
            <div className="w-16 h-16 flex items-center justify-center bg-blue-50 text-blue-600 rounded-[22px] transition-transform duration-300 hover:scale-110">
              <CalendarIcon size={32} strokeWidth={1.5} />
            </div>
            <div className="space-y-4">
              <h3 className="font-heading font-bold text-2xl text-haven-navy tracking-tight">{t('value.flexibility.title')}</h3>
              <p className="text-haven-stone text-sm leading-relaxed antialiased font-medium opacity-90">
                {t('value.flexibility.desc')}
              </p>
            </div>
          </div>
          
          <div className="space-y-8">
            <div className="w-16 h-16 flex items-center justify-center bg-red-50 text-haven-red rounded-[22px] transition-transform duration-300 hover:scale-110">
              <ShieldCheck size={32} strokeWidth={1.5} />
            </div>
            <div className="space-y-4">
              <h3 className="font-heading font-bold text-2xl text-haven-navy tracking-tight">{t('value.community.title')}</h3>
              <p className="text-haven-stone text-sm leading-relaxed antialiased font-medium opacity-90">
                {t('value.community.desc')}
              </p>
            </div>
          </div>
          
          <div className="space-y-8">
            <div className="w-16 h-16 flex items-center justify-center bg-green-50 text-green-600 rounded-[22px] transition-transform duration-300 hover:scale-110">
              <Sparkles size={32} strokeWidth={1.5} />
            </div>
            <div className="space-y-4">
              <h3 className="font-heading font-bold text-2xl text-haven-navy tracking-tight">{t('value.ready.title')}</h3>
              <p className="text-haven-stone text-sm leading-relaxed antialiased font-medium opacity-90">
                {t('value.ready.desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MARKET STATS SECTION */}
      <section className="bg-haven-gray/50 py-24 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mb-16 space-y-4">
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-haven-navy leading-tight">
              {t('stats.title')}
            </h2>
            <p className="text-haven-stone text-lg font-light leading-relaxed">
              {t('stats.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-soft border border-gray-100 hover:shadow-premium transition-all duration-500 group">
              <div className="mb-6 w-12 h-12 rounded-xl bg-haven-red/5 text-haven-red flex items-center justify-center group-hover:bg-haven-red group-hover:text-white transition-colors">
                <AlertCircle size={24} />
              </div>
              <div className="space-y-3">
                <span className="block font-heading font-bold text-5xl text-haven-navy tracking-tight">{t('stats.stat1.val')}</span>
                <p className="text-sm text-haven-stone leading-relaxed font-medium">{t('stats.stat1.label')}</p>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[2.5rem] shadow-soft border border-gray-100 hover:shadow-premium transition-all duration-500 group">
              <div className="mb-6 w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Route size={24} />
              </div>
              <div className="space-y-3">
                <span className="block font-heading font-bold text-5xl text-haven-navy tracking-tight">{t('stats.stat2.val')}</span>
                <p className="text-sm text-haven-stone leading-relaxed font-medium">{t('stats.stat2.label')}</p>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[2.5rem] shadow-soft border border-gray-100 hover:shadow-premium transition-all duration-500 group">
              <div className="mb-6 w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <BarChart3 size={24} />
              </div>
              <div className="space-y-3">
                <span className="block font-heading font-bold text-5xl text-haven-navy tracking-tight">{t('stats.stat3.val')}</span>
                <p className="text-sm text-haven-stone leading-relaxed font-medium">{t('stats.stat3.label')}</p>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[2.5rem] shadow-soft border border-gray-100 hover:shadow-premium transition-all duration-500 group">
              <div className="mb-6 w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
                <Users size={24} />
              </div>
              <div className="space-y-3">
                <span className="block font-heading font-bold text-5xl text-haven-navy tracking-tight">{t('stats.stat4.val')}</span>
                <p className="text-sm text-haven-stone leading-relaxed font-medium">{t('stats.stat4.label')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TENANT COMPARISON SECTION */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="max-w-4xl mx-auto mb-12 space-y-4">
            <h2 className="font-heading font-medium text-3xl md:text-4xl lg:text-5xl text-haven-navy leading-tight tracking-tight">
              Le juste prix de la mobilité pour le locataire
            </h2>
            <div className="flex items-center justify-center gap-3 text-haven-stone">
              <div className="w-8 h-8 rounded-full bg-haven-navy/5 flex items-center justify-center">
                <Info size={14} className="text-haven-navy" />
              </div>
              <p className="text-xs font-medium opacity-80">
                Séjour d’une semaine à La Rochelle du dimanche 12 juillet au vendredi 17 juillet
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch max-w-6xl mx-auto pt-4">
            {/* Hotel Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-gray-50/50 rounded-[2rem] p-8 border border-gray-100 flex flex-col items-center justify-center space-y-6 h-full"
            >
              <h3 className="text-xl font-black text-haven-navy tracking-tight">Hôtel low cost</h3>
              <div className="space-y-1">
                <div className="text-5xl font-black text-haven-navy tracking-tighter">260 €</div>
              </div>
              <div className="space-y-1 pt-2">
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
              className="bg-gray-50/50 rounded-[2rem] p-8 border border-gray-100 flex flex-col items-center justify-center space-y-6 h-full"
            >
              <div className="flex items-center justify-center">
                <img src="/Logoairbnb.png" alt="Airbnb" className="h-10 w-auto" />
              </div>
              <div className="w-full space-y-4">
                <div className="space-y-0.5">
                  <div className="text-3xl font-black text-haven-navy tracking-tighter">280 €</div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">studio seul</p>
                </div>
                <div className="h-px w-8 bg-gray-200 mx-auto"></div>
                <div className="space-y-0.5">
                  <div className="text-3xl font-black text-haven-navy tracking-tighter">230 €</div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">chambre chez l’habitant</p>
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
              <div className="flex-1 w-full bg-white rounded-[1.9rem] p-8 flex flex-col items-center justify-center space-y-6">
                <Logo className="h-9" />
                <div className="space-y-1">
                  <div className="text-6xl font-black text-haven-red tracking-tighter">175 €</div>
                  <p className="text-[11px] font-black text-haven-navy uppercase tracking-[0.2em]">PAR SEMAINE</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* OWNER YIELD COMPARISON SECTION */}
      <section className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="max-w-4xl mx-auto mb-12 space-y-4">
            <h2 className="font-heading font-medium text-3xl md:text-4xl lg:text-5xl text-haven-navy leading-tight tracking-tight">
              Rentabilité propriétaire
            </h2>
            <div className="flex items-center justify-center gap-3 text-haven-stone">
              <div className="w-8 h-8 rounded-full bg-haven-navy/5 flex items-center justify-center">
                <Info size={14} className="text-haven-navy" />
              </div>
              <p className="text-xs font-medium opacity-80">
                Exemple : T4 en ville moyenne peu tendue
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch max-w-6xl mx-auto">
            {/* Basic Furnished Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-[2rem] shadow-premium border border-gray-100 flex flex-col overflow-hidden h-full"
            >
              <div className="bg-haven-navy p-5 flex items-center justify-center">
                <h3 className="text-base font-bold text-white tracking-tight">Logement entier meublé</h3>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-1">
                <div className="text-5xl font-black text-haven-navy tracking-tighter">900 €</div>
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
              <div className="bg-gray-100 p-5 flex flex-col items-center justify-center">
                <h3 className="text-base font-bold text-haven-navy tracking-tight text-center">Colocation<br/>classique</h3>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
                <div className="space-y-1">
                  <div className="text-5xl font-black text-haven-navy tracking-tighter">1 350 €</div>
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
              <div className="bg-haven-red p-6 flex items-center justify-center">
                <Logo className="h-10" white />
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
                <div className="space-y-1">
                  <div className="text-5xl font-black text-haven-red tracking-tighter">1 870 €</div>
                  <p className="text-[10px] font-black text-haven-red uppercase tracking-widest leading-none">/ mois</p>
                </div>
                <p className="text-xs font-bold text-haven-red tracking-tight">145 € / semaine par chambre</p>
                
                <div className="w-full pt-2">
                  <div className="bg-haven-red text-white py-2 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-haven-red/20">
                    Solution la plus rentable
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Efficiency Comparison Bar & CTA */}
          <div className="mt-12 flex flex-col md:flex-row items-center justify-center gap-6">
            <div className="inline-flex items-center gap-4 px-8 py-4 bg-white border border-haven-red/20 rounded-2xl shadow-lg animate-fade-in">
              <div className="w-10 h-10 rounded-full bg-haven-red text-white flex items-center justify-center shadow-md shadow-haven-red/10">
                <TrendingUp size={20} />
              </div>
              <div className="flex items-baseline gap-2">
                 <span className="text-4xl font-black text-haven-red tracking-tighter">+520 €</span>
                 <span className="text-sm font-bold text-haven-red opacity-80">/ mois</span>
              </div>
              <div className="h-6 w-px bg-gray-100 hidden md:block mx-2"></div>
              <p className="text-xs font-bold text-haven-stone tracking-tight hidden md:block">
                vs colocation classique
              </p>
            </div>

            <Button 
              size="lg" 
              className="bg-haven-navy text-white hover:bg-haven-navy/90 px-8 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all text-xs h-[72px]"
              onClick={handlePublishClick}
            >
              Publier un logement
            </Button>
          </div>
        </div>
      </section>

      {/* Final Space between sections */}
      <div className="h-12"></div>

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
  );
};
