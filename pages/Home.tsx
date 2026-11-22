import { PRICE_COMPARISON, comparisonNotice, comparisonStayLabel, havenIsCheapest } from '../services/priceComparison';

import React, { useRef, useState } from 'react';
import { Reveal } from '../components/Reveal';
import { Calendar as CalendarIcon, ShieldCheck, Sparkles, TrendingUp, BarChart3, AlertCircle, Users, Route } from 'lucide-react';
import { Button } from '../components/Button';
import { HomeSearchPreview } from '../components/HomeSearchPreview';
import { Logo } from '../components/Logo';
import { HavenPhotoBackground } from '../components/HavenPhotoBackground';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

/** Section title with its brick eyebrow, the visual anchor repeated across the page. */
function SectionHeading({ eyebrow, title, subtitle, dark = false, center = false }: { eyebrow: string; title: string; subtitle?: string; dark?: boolean; center?: boolean }) {
  return <div className={`max-w-3xl ${center ? 'mx-auto text-center' : ''}`}>
    <p className={`flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] ${center ? 'justify-center' : ''} ${dark ? 'text-[#E2A9BF]' : 'text-haven-red'}`}>
      <span aria-hidden="true" className={`h-px w-8 ${dark ? 'bg-[#E2A9BF]' : 'bg-haven-red'}`} />{eyebrow}
    </p>
    <h2 className={`mt-3 font-heading text-[1.75rem] font-bold leading-[1.15] tracking-tight sm:text-4xl md:text-[2.75rem] ${dark ? 'text-white' : 'text-haven-navy'}`}>{title}</h2>
    {subtitle && <p className={`mt-3 text-base leading-relaxed sm:text-lg ${dark ? 'text-white/70' : 'text-haven-stone'}`}>{subtitle}</p>}
  </div>;
}

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
      {/* WHY HAVEN: three promises, numbered, on the cream background */}
      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-6 md:py-24">
        <SectionHeading eyebrow="Pourquoi Haven" title="Une colocation pensée pour les vies qui bougent" />
        <div className="mt-8 grid gap-4 sm:mt-12 md:grid-cols-3 md:gap-6">
          {([
            [CalendarIcon, 'value.flexibility'],
            [ShieldCheck, 'value.community'],
            [Sparkles, 'value.ready'],
          ] as const).map(([Icon, key], index) => (
            <Reveal key={key} delay={index * 100} className="group relative overflow-hidden rounded-[1.75rem] border border-haven-navy/5 bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-8">
              <span aria-hidden="true" className="absolute -right-2 -top-6 font-heading text-[7rem] font-bold leading-none text-haven-sand transition-colors group-hover:text-haven-blush">0{index + 1}</span>
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-haven-red text-white shadow-lg shadow-haven-red/25">
                  <Icon size={22} strokeWidth={1.8} />
                </div>
                <h3 className="mt-5 font-heading text-xl font-bold tracking-tight text-haven-navy sm:text-2xl">{t(`${key}.title`)}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-haven-stone">{t(`${key}.desc`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* THE PROBLEM: market figures on the navy band, the strongest contrast of the page */}
      <section className="relative overflow-hidden bg-haven-navy py-14 text-white md:py-24">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-haven-red/25 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-6">
          <SectionHeading eyebrow="Le constat" title={t('stats.title')} subtitle={t('stats.subtitle')} dark />
          <div className="mt-8 grid grid-cols-1 gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {([[AlertCircle, 'stats.stat1.val', 'stats.stat1.label'], [Route, 'stats.stat2.val', 'stats.stat2.label'], [BarChart3, 'stats.stat3.val', 'stats.stat3.label'], [Users, 'stats.stat4.val', 'stats.stat4.label']] as const).map(([Icon, value, label], index) => (
              <Reveal key={index} delay={index * 80} className="flex items-start gap-4 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm transition-colors hover:bg-white/[0.08] sm:block sm:p-7">
                <Icon size={20} className="hidden text-[#E2A9BF] sm:block" aria-hidden="true" />
                {/* On phones the figure sits beside its explanation: four stacked cards were too tall. */}
                <div className="w-[6.5rem] shrink-0 sm:w-auto">
                  <span className="block font-heading text-[2rem] font-bold leading-none tracking-tight sm:mt-4 sm:text-5xl">{t(value)}</span>
                  <span aria-hidden="true" className="mt-3 block h-0.5 w-10 rounded-full bg-[#E2A9BF]" />
                </div>
                <p className="text-sm leading-relaxed text-white/70 sm:mt-3 sm:text-[15px]">{t(label)}</p>
              </Reveal>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-5 rounded-[1.75rem] bg-white p-6 text-haven-navy sm:mt-12 sm:p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-haven-blush text-haven-red"><Route size={20} aria-hidden="true" /></div>
              <p className="max-w-2xl text-base font-medium leading-relaxed sm:text-lg">{t('stats.recurring.pitch')}</p>
            </div>
            <Button size="lg" className="w-full shrink-0 rounded-xl bg-haven-red px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-haven-red/25 hover:bg-haven-red/90 md:w-auto" onClick={handleRecurringClick}>
              {t('stats.recurring.cta')}
            </Button>
          </div>
        </div>
      </section>

      {/* TENANT COMPARISON: warm sand background, the Haven card in navy so it stands out */}
      <section className="relative overflow-hidden bg-haven-sand py-14 md:py-24">
        <div className="relative z-10 mx-auto max-w-7xl px-5 text-center sm:px-6">
          <SectionHeading eyebrow="Pour les locataires" title="Le juste prix de la mobilité" subtitle={comparisonStayLabel()} center />

          <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 items-stretch gap-4 sm:mt-14 sm:gap-6 md:grid-cols-3">
            {/* Hotel */}
            <Reveal className="flex h-full flex-col items-center justify-center rounded-[1.75rem] bg-white p-6 shadow-soft sm:p-8">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-haven-stone">{PRICE_COMPARISON.hotel.label}</h3>
              <div className="mt-3 font-heading text-4xl font-bold tracking-tight text-haven-navy sm:text-5xl">{PRICE_COMPARISON.hotel.priceEuros} €</div>
              <p className="mt-3 text-sm font-semibold text-haven-navy">Ex. : {PRICE_COMPARISON.hotel.example}</p>
              <p className="mt-1 text-[13px] text-haven-stone">{PRICE_COMPARISON.hotel.description}</p>
            </Reveal>

            {/* Airbnb */}
            <Reveal className="flex h-full flex-col items-center justify-center rounded-[1.75rem] bg-white p-6 shadow-soft sm:p-8" delay={100}>
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-haven-stone">Airbnb</h3>
              <div className="mt-3 grid w-full grid-cols-2 gap-3 sm:gap-4">
                {[PRICE_COMPARISON.airbnbStudio, PRICE_COMPARISON.airbnbRoom].map(offer => <div key={offer.label} className="rounded-2xl bg-haven-sand/70 px-3 py-4">
                  <div className="font-heading text-2xl font-bold tracking-tight text-haven-navy sm:text-3xl">{offer.priceEuros} €</div>
                  <p className="mt-1 text-xs font-semibold text-haven-navy">{offer.label}</p>
                  <p className="mt-1 text-[12px] leading-snug text-haven-stone">{offer.description}</p>
                </div>)}
              </div>
            </Reveal>

            {/* Haven */}
            <Reveal className="relative flex h-full flex-col items-center justify-center rounded-[1.75rem] bg-haven-navy p-6 text-white shadow-lift sm:p-8" from="scale">
              {havenIsCheapest() && <div className="absolute -top-3.5 rounded-full bg-haven-red px-5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow-lg shadow-haven-red/30">
                Le moins cher dans cet exemple
              </div>}
              <Logo white className="h-8 sm:h-9" />
              <div className="mt-4 font-heading text-5xl font-bold tracking-tight sm:text-6xl">{PRICE_COMPARISON.haven.priceEuros === null ? '—' : `${PRICE_COMPARISON.haven.priceEuros} €`}</div>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#E2A9BF]">Pour ce séjour</p>
              <p className="mt-3 text-[13px] text-white/70">{PRICE_COMPARISON.haven.description}</p>
            </Reveal>
          </div>
          {/* Comparative advertising: survey date, scope of prices and sources must be stated (Code de la consommation L122-1 s.). */}
          <p className="mx-auto mt-8 max-w-4xl text-xs leading-relaxed text-haven-stone/90">{comparisonNotice()}</p>
        </div>
      </section>

      {/* OWNER YIELD COMPARISON SECTION */}
      <section className="relative overflow-hidden bg-white py-14 md:py-24">
        <div className="relative z-10 mx-auto max-w-7xl px-5 text-center sm:px-6">
          <SectionHeading eyebrow="Pour les propriétaires" title="Louez mieux, sans vacance" subtitle="Exemple : un T4 en ville moyenne peu tendue, occupé toute l’année." center />

          <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 items-stretch gap-4 sm:mt-14 sm:gap-6 md:grid-cols-3">
            {/* Basic Furnished Card */}
            <Reveal className="flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-haven-sand">
              <div className="flex items-center justify-center p-4 pb-0 sm:p-6 sm:pb-0">
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-haven-stone">Logement entier meublé</h3>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 space-y-1">
                <div className="font-heading text-4xl font-bold tracking-tight text-haven-navy sm:text-5xl">900 €</div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">/ mois</p>
              </div>
            </Reveal>

            {/* Classic Colocation Card */}
            <Reveal className="flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-haven-sand" delay={100}>
              <div className="flex items-center justify-center p-4 pb-0 sm:p-6 sm:pb-0">
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-haven-stone">Colocation classique</h3>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 space-y-1.5 sm:space-y-3">
                <div className="space-y-1">
                  <div className="font-heading text-4xl font-bold tracking-tight text-haven-navy sm:text-5xl">1 350 €</div>
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">/ mois</p>
                </div>
                <div className="h-px w-6 bg-gray-100"></div>
                <p className="text-xs font-bold text-haven-navy tracking-tight">450 € HC / chambre</p>
              </div>
            </Reveal>

            {/* Haven Card */}
            <Reveal className="relative z-10 flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-lift ring-2 ring-haven-red" from="scale">
              <div className="bg-haven-red p-3 sm:p-6 flex items-center justify-center">
                <Logo className="h-7 sm:h-10" white />
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 space-y-2 sm:space-y-4">
                <div className="space-y-1">
                  <div className="font-heading text-4xl font-bold tracking-tight text-haven-red sm:text-5xl">1 870 €</div>
                  <p className="text-[11px] font-bold text-haven-red uppercase tracking-widest leading-none">/ mois</p>
                </div>
                <p className="text-xs font-bold text-haven-red tracking-tight">145 € / semaine par chambre</p>
                
                <div className="w-full sm:pt-2">
                  <div className="bg-haven-red text-white py-2 px-4 rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-lg shadow-haven-red/20">
                    Solution la plus rentable
                  </div>
                </div>
              </div>
            </Reveal>
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
                 <span className="font-heading text-2xl font-bold tracking-tight text-haven-red sm:text-4xl">+520 €</span>
                 <span className="text-xs sm:text-sm font-bold text-haven-red opacity-80">/ mois</span>
              </div>
              <div className="h-6 w-px bg-gray-100 hidden md:block mx-2"></div>
              <p className="text-xs font-bold text-haven-stone tracking-tight">
                vs colocation classique
              </p>
            </div>

            <Button
              size="lg"
              className="h-12 w-full rounded-xl bg-haven-navy px-8 text-sm font-bold text-white shadow-lg transition-all hover:bg-haven-navy/90 sm:h-[64px] sm:w-auto"
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
