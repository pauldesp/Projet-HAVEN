import { PRICE_COMPARISON, comparisonNotice, comparisonStayLabel, havenIsCheapest } from '../services/priceComparison';

import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, KeyRound, Search, CalendarRange } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { HomeSearchPreview } from '../components/HomeSearchPreview';
import { Logo } from '../components/Logo';
import { HavenPhotoBackground } from '../components/HavenPhotoBackground';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

// Paul's own texts (translations, section titles, comparison wording) are kept word for word. The additions
// (hero label, rotating sentence, promises, steps) were proposed during the redesign and approved by him.
const container = 'mx-auto w-full max-w-6xl px-5 sm:px-8';
const sectionTitle = 'font-heading text-[2.25rem] font-normal leading-[1.08] text-haven-ink sm:text-5xl md:text-[3.5rem]';
const lead = 'text-base leading-relaxed text-haven-stone sm:text-[17px]';
const pillDark = 'inline-flex min-h-11 items-center gap-2 rounded-full bg-haven-navy px-5 text-sm font-semibold text-white hover:bg-haven-navy-deep';
const pillLight = 'inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-haven-ink hover:bg-haven-sand';

/** The end of the sentence changes on its own, softly (blur and scale), like a thought being completed. */
const SITUATIONS = ['semaines d’alternance', 'stages de six mois', 'missions de quelques semaines', 'allers-retours entre deux villes'];

function RotatingSituation() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % SITUATIONS.length), 2600);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="relative mx-auto block h-[2.3em] max-w-[16ch] sm:h-[1.2em] sm:max-w-none">
    {SITUATIONS.map((situation, position) => {
      const active = position === index;
      return <span key={situation} aria-hidden="true"
        className="absolute inset-x-0 top-0 text-haven-red transition-[opacity,filter,transform] duration-700"
        style={{ opacity: active ? 1 : 0, filter: active ? 'blur(0)' : 'blur(6px)', transform: active ? 'none' : 'scale(0.94) translateY(0.15em)' }}>
        {situation}
      </span>;
    })}
    <span className="sr-only">{SITUATIONS.join(', ')}</span>
  </span>;
}

const PROMISES = [
  'Quelques nuits ou plusieurs mois, selon votre besoin',
  'Plusieurs périodes de l’année réservées en une seule fois',
  'Un logement meublé et équipé, prêt à vivre',
  'Des logements contrôlés et des membres vérifiés',
  'Remboursement intégral plus de 14 jours avant l’arrivée',
  'Paiement en ligne sécurisé',
];

const STEPS = [
  { icon: Search, title: 'Cherchez une ville et vos dates', text: 'Une seule période, ou plusieurs plages dans l’année : Haven compare les chambres libres pour chacune.' },
  { icon: CalendarRange, title: 'Réservez en une fois', text: 'Les prix de tous vos séjours sont fixés dès la réservation. Pour une série, seul le premier séjour est payé tout de suite, les suivants un mois avant chaque arrivée.' },
  { icon: KeyRound, title: 'Installez-vous', text: 'La chambre est meublée, la cuisine équipée. L’état des lieux d’entrée se fait depuis votre téléphone.' },
];

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const searchRef = useRef<HTMLDivElement>(null);
  const [recurringRequest, setRecurringRequest] = useState(0);

  const handleRecurringClick = () => {
    setRecurringRequest(count => count + 1);
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePublishClick = () => {
    // Publishing needs an owner account: others sign in (or switch) as an owner first.
    if (!currentUser || (currentUser.role !== UserRole.OWNER && currentUser.role !== UserRole.ADMIN)) navigate('/login?redirect=/owner/publish&role=OWNER');
    else navigate('/owner/publish');
  };

  const havenPrice = PRICE_COMPARISON.haven.priceEuros;

  return (
    <div className="w-full bg-haven-cream font-body text-haven-ink selection:bg-haven-navy/10">
      {/* HERO: the photo, one large title, the search. */}
      <div className="home-search-hero relative flex min-h-[680px] w-full flex-col items-center px-4 py-12 md:py-20">
        <div className="home-search-backdrop" aria-hidden="true">
          <div className="home-search-backdrop-frame"><HavenPhotoBackground /></div>
        </div>

        <div className="relative z-10 w-full max-w-4xl animate-fade-in-up text-center">
          <p className="text-sm text-white/75">Colocation flexible</p>
          <h1 className="mx-auto mt-4 max-w-3xl font-heading text-[2.6rem] font-normal leading-[1.04] text-white sm:text-6xl md:text-7xl">
            {t('hero.title')}
          </h1>
          <p className="mx-auto mt-5 max-w-xl px-2 text-[15px] leading-relaxed text-white/75 md:text-base">
            {t('hero.subtitle')}
          </p>
          <div ref={searchRef} className="w-full scroll-mt-20 pt-8 md:pt-10">
            <HomeSearchPreview recurringRequest={recurringRequest} />
          </div>
        </div>
      </div>

      {/* SIGNATURE: who Haven is for, in one sentence that completes itself. */}
      <section className={`${container} py-20 text-center md:py-28`}>
        <p className="font-heading text-[2rem] leading-[1.15] text-haven-ink sm:text-5xl">
          Un chez-vous pour vos <RotatingSituation />
        </p>
      </section>

      {/* VALUES: three promises, plain columns separated by thin rules. */}
      <section className={`${container} pb-20 md:pb-28`}>
        <div className="grid gap-x-10 gap-y-12 md:grid-cols-3">
          {(['value.flexibility', 'value.community', 'value.ready'] as const).map((key, index) => <Reveal key={key} delay={index * 60} className="border-t border-haven-gray pt-6">
            <h2 className="font-heading text-3xl font-normal leading-tight text-haven-ink sm:text-[2.25rem]">{t(`${key}.title` as 'value.flexibility.title')}</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-haven-stone sm:text-base">{t(`${key}.desc` as 'value.flexibility.desc')}</p>
          </Reveal>)}
        </div>
      </section>

      {/* WHAT YOU GET: a statement on the left, the concrete promises on the right. */}
      <section className={`${container} grid items-center gap-10 pb-20 md:grid-cols-2 md:gap-16 md:pb-28`}>
        <Reveal>
          <h2 className={sectionTitle}>Une chambre meublée, le temps qu’il vous faut.</h2>
        </Reveal>
        <Reveal delay={80} className="rounded-[2rem] bg-haven-sand p-6 sm:p-8">
          <ul className="divide-y divide-haven-gray">
            {PROMISES.map(promise => <li key={promise} className="flex items-center gap-4 py-3.5 text-[15px] text-haven-ink">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-haven-red text-white"><Check size={14} strokeWidth={2.5} aria-hidden="true" /></span>
              {promise}
            </li>)}
          </ul>
        </Reveal>
      </section>

      {/* HOW IT WORKS: three plain steps in a soft panel. */}
      <section className={`${container} pb-20 md:pb-28`}>
        <Reveal className="grid gap-10 rounded-[2rem] bg-haven-sand p-7 sm:p-10 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:p-14">
          <div>
            <h2 className={sectionTitle}>Comment ça marche</h2>
            <Link to="/how-it-works" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-gray-300 px-5 text-sm font-semibold text-haven-ink hover:bg-white">
              En savoir plus <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <ol className="space-y-8">
            {STEPS.map(({ icon: Icon, title, text }) => <li key={title} className="flex gap-5">
              <Icon size={26} strokeWidth={1.5} className="mt-0.5 shrink-0 text-haven-navy" aria-hidden="true" />
              <div>
                <h3 className="text-lg font-semibold text-haven-ink sm:text-xl">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-haven-stone">{text}</p>
              </div>
            </li>)}
          </ol>
        </Reveal>
      </section>

      {/* THE PROBLEM: figures set large, separated by thin rules. */}
      <section className={`${container} pb-20 md:pb-28`}>
        <div className="max-w-3xl">
          <h2 className={sectionTitle}>{t('stats.title')}</h2>
          <p className={`mt-5 ${lead}`}>{t('stats.subtitle')}</p>
        </div>
        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {([['stats.stat1.val', 'stats.stat1.label'], ['stats.stat2.val', 'stats.stat2.label'], ['stats.stat3.val', 'stats.stat3.label'], ['stats.stat4.val', 'stats.stat4.label']] as const).map(([value, label], index) => <Reveal key={value} delay={index * 60} className="border-t border-haven-gray pt-6">
            <span className="block font-heading text-5xl leading-none text-haven-ink">{t(value)}</span>
            <p className="mt-4 text-[15px] leading-relaxed text-haven-stone">{t(label)}</p>
          </Reveal>)}
        </div>

        {/* Recurring search: the one dark block of the page. */}
        <Reveal className="mt-14 flex flex-col gap-8 rounded-[2rem] bg-haven-navy p-8 text-white sm:p-12 md:flex-row md:items-center md:justify-between md:p-14">
          <p className="max-w-2xl font-heading text-[1.75rem] leading-[1.2] sm:text-4xl">{t('stats.recurring.pitch')}</p>
          <button type="button" onClick={handleRecurringClick} className={`${pillLight} shrink-0 self-start md:self-center`}>
            {t('stats.recurring.cta')} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </Reveal>
      </section>

      {/* TENANT COMPARISON */}
      <section className={`${container} pb-20 text-center md:pb-28`}>
        <h2 className={sectionTitle}>Le juste prix de la mobilité pour le locataire</h2>
        <p className={`mx-auto mt-5 max-w-2xl ${lead}`}>{comparisonStayLabel()}</p>

        <div className="mt-12 grid items-stretch gap-4 md:grid-cols-3">
          <Reveal className="flex flex-col items-center justify-center rounded-[2rem] border border-haven-gray bg-white p-8">
            <p className="text-base font-semibold text-haven-ink">{PRICE_COMPARISON.hotel.label}</p>
            <p className="mt-3 font-heading text-5xl text-haven-ink">{PRICE_COMPARISON.hotel.priceEuros} €</p>
            <p className="mt-4 text-sm text-haven-stone">Ex. : {PRICE_COMPARISON.hotel.example}</p>
            <p className="mt-1 text-[13px] text-haven-stone">{PRICE_COMPARISON.hotel.description}</p>
          </Reveal>

          <Reveal delay={60} className="flex flex-col items-center justify-center rounded-[2rem] border border-haven-gray bg-white p-8">
            <p className="text-base font-semibold text-haven-ink">Airbnb</p>
            <div className="mt-3 grid w-full grid-cols-2 gap-3">
              {[PRICE_COMPARISON.airbnbStudio, PRICE_COMPARISON.airbnbRoom].map(offer => <div key={offer.label} className="rounded-2xl bg-haven-sand px-3 py-4">
                <p className="font-heading text-3xl text-haven-ink">{offer.priceEuros} €</p>
                <p className="mt-1 text-xs font-medium text-haven-ink">{offer.label}</p>
                <p className="mt-1 text-[12px] leading-snug text-haven-stone">{offer.description}</p>
              </div>)}
            </div>
          </Reveal>

          <Reveal delay={120} className="relative flex flex-col items-center justify-center rounded-[2rem] bg-haven-navy p-8 text-white">
            {havenIsCheapest() && <p className="absolute -top-3.5 rounded-full bg-haven-red px-4 py-1.5 text-xs font-semibold text-white">Le moins cher dans cet exemple</p>}
            <Logo white className="h-8" />
            <p className="mt-4 font-heading text-6xl">{havenPrice === null ? '—' : `${havenPrice} €`}</p>
            <p className="mt-2 text-sm text-white/70">Pour ce séjour</p>
            <p className="mt-3 text-[13px] text-white/60">{PRICE_COMPARISON.haven.description}</p>
          </Reveal>
        </div>
        {/* Comparative advertising: survey date, scope of prices and sources must be stated (Code de la consommation L122-1 s.). */}
        <p className="mx-auto mt-8 max-w-4xl text-xs leading-relaxed text-haven-stone">{comparisonNotice()}</p>
      </section>

      {/* OWNER YIELD COMPARISON */}
      <section className="bg-haven-sand py-20 md:py-28">
        <div className={`${container} text-center`}>
          <h2 className={sectionTitle}>Rentabilité propriétaire</h2>
          <p className={`mx-auto mt-5 max-w-2xl ${lead}`}>Exemple : T4 en ville moyenne peu tendue</p>
          <p className="mt-1 text-sm text-haven-stone">Base : occupation complète</p>

          <div className="mt-12 grid items-stretch gap-4 md:grid-cols-3">
            {[
              { label: 'Logement entier meublé', price: '900 €', detail: null },
              { label: 'Colocation classique', price: '1 350 €', detail: '450 € HC / chambre' },
            ].map((offer, index) => <Reveal key={offer.label} delay={index * 60} className="flex flex-col items-center justify-center rounded-[2rem] bg-white p-8">
              <p className="text-base font-semibold text-haven-ink">{offer.label}</p>
              <p className="mt-3 font-heading text-5xl text-haven-ink">{offer.price}</p>
              <p className="mt-1 text-sm text-haven-stone">/ mois</p>
              {offer.detail && <p className="mt-4 text-sm font-medium text-haven-ink">{offer.detail}</p>}
            </Reveal>)}
            <Reveal delay={120} className="flex flex-col items-center justify-center rounded-[2rem] bg-haven-navy p-8 text-white">
              <Logo white className="h-8" />
              <p className="mt-4 font-heading text-6xl">1 870 €</p>
              <p className="mt-1 text-sm text-white/70">/ mois</p>
              <p className="mt-4 text-sm font-medium">145 € / semaine par chambre</p>
              <p className="mt-5 rounded-full bg-haven-red px-4 py-1.5 text-xs font-semibold">Solution la plus rentable</p>
            </Reveal>
          </div>

          <p className={`mx-auto mt-10 max-w-2xl ${lead}`}>
            Les locataires récurrents réservent sur plusieurs mois : votre calendrier se remplit plus vite et plus longtemps.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <p className="text-haven-ink">
              <span className="font-heading text-4xl text-haven-red">+520 €</span>
              <span className="ml-2 text-sm text-haven-stone">/ mois vs colocation classique</span>
            </p>
            <button type="button" onClick={handlePublishClick} className={pillDark}>
              Publier un logement <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
