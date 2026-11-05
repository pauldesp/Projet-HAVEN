import { cheapestStayPrice } from '../services/stayPrice';
import { isRoomAvailableForStay } from '../services/availability';

import React from 'react';
import { Listing, BookingAvailability } from '../types';
import { MapPin, Users, Star, ArrowRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { RecurringMatch, SearchPeriod, recurringListingLink, completionForPeriod } from '../services/recurringSearch';
import { readSearchDates } from '../services/searchDates';
import { countNights } from '../services/stay';
import { getListingPhotoUrls } from '../services/media';
import { ListingPhotoCarousel } from './ListingPhotoCarousel';

interface ListingCardProps {
  listing: Listing;
  recurrence?: RecurringMatch;
  requestedPeriods?: SearchPeriod[];
  flexibleDates?: boolean;
  completions?: (ReturnType<typeof completionForPeriod>)[];
  availability?: BookingAvailability[];
  stayOverride?: { start: string; end: string; label?: string };
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing, stayOverride, availability, recurrence, requestedPeriods = [], flexibleDates = false, completions = [] }) => {
  const { t, tr, locale } = useLanguage();
  const [searchParams] = useSearchParams();
  const stayParams = new URLSearchParams();
  const dates = recurrence?.periods.find(period => period.stay)?.stay || stayOverride || readSearchDates(searchParams);
  const formatDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const rooms = availability && dates.start && dates.end ? listing.rooms.filter(room => isRoomAvailableForStay(room, listing, availability, dates.start, dates.end)) : listing.rooms;
  const quote = availability ? cheapestStayPrice(listing, availability, dates.start, dates.end) : null;
  const money = (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(amount);
  const availablePeriods = recurrence?.periods.filter(period => period.stay && period.total !== null) || [];
  const totalNights = availablePeriods.reduce((sum, period) => sum + countNights(period.stay!.start, period.stay!.end), 0);
  const nightlyAverage = recurrence && totalNights > 0 ? recurrence.total / totalNights : null;
  if (dates.start) stayParams.set('start', dates.start);
  if (dates.end) stayParams.set('end', dates.end);
  const stayQuery = stayParams.toString();
  const listingHref = recurrence ? recurringListingLink(listing.id, dates, requestedPeriods, flexibleDates) : `/listing/${listing.id}${stayQuery ? `?${stayQuery}` : ''}`;
  const photos = getListingPhotoUrls(listing);

  return (
    <div className="group flex flex-col rounded-[2rem] bg-white border border-gray-100 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 focus-within:shadow-2xl">
      <div className="px-3 pt-3"><div className="relative aspect-[16/10] overflow-hidden rounded-2xl mb-4">
        <div className="h-full w-full md:hidden"><ListingPhotoCarousel key={listing.id} photos={photos.length ? photos : [listing.mainPhotoUrl]} title={listing.title} href={listingHref} /></div>
        <Link to={listingHref} className="hidden h-full w-full md:block" aria-label={`Voir ${listing.title}`}><img
          src={listing.mainPhotoUrl} 
          alt={listing.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        /></Link>
        <div className="pointer-events-none absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-haven-navy uppercase tracking-wider shadow-sm">
          {listing.type === 'HOUSE' ? 'Maison' : 'Appartement'}
        </div>
        {stayOverride?.label && (
          <div className="pointer-events-none absolute top-12 left-3 bg-haven-navy/95 px-3 py-1.5 rounded-full text-[10px] font-bold text-white shadow-sm">
            {stayOverride.label}
          </div>
        )}
      </div></div>
    <Link to={listingHref} className="flex flex-col rounded-[2rem] px-3 pb-3">
      <div className="flex-1 px-2">
        <div className="flex justify-between items-start mb-1.5">
          <h3 className="font-heading font-bold text-lg text-haven-navy line-clamp-1 group-hover:text-haven-red transition-colors">
            {listing.title}
          </h3>
          <div className="flex items-center gap-1 text-sm font-bold text-haven-navy">
            <Star size={14} className="fill-haven-navy text-haven-navy" />
            <span>{listing.rating}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-gray-400 text-xs mb-3 font-medium">
          <MapPin size={12} />
          <span>{listing.city}</span>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500 mb-6 font-medium">
          <span className="flex items-center gap-1">
            <Users size={14} />
            {availability && dates.start && dates.end ? rooms.length : listing.availableRooms} {t('card.available')}
          </span>
          <span className="w-1 h-1 rounded-full bg-gray-200"></span>
          <span>{listing.surface}m²</span>
        </div>

        <div className="flex items-start justify-between gap-3 pt-4 border-t border-gray-100">
          <div className="flex min-w-0 flex-col">
            {recurrence ? <>
              {nightlyAverage !== null && <>
                <span className="font-heading font-bold text-xl text-haven-navy">{money(nightlyAverage)} <span className="text-sm font-medium">/ nuit</span></span>
                <span className="text-[11px] text-gray-500">En moyenne · frais inclus</span>
              </>}
            </> : quote ? <>
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{t('card.from')}</span>
              <span className="font-heading font-bold text-xl text-haven-navy">{money(quote.total)} <span className="text-sm font-medium">{tr('au total')}</span></span>
              <span className="mt-1 text-xs text-gray-500">{quote.nights} {tr(quote.nights === 1 ? 'nuit · frais inclus' : 'nuits · frais inclus')}</span>
            </> : <span className="text-sm font-semibold text-haven-navy">{tr(dates.start && dates.end ? availability ? 'Indisponible pour ces dates' : 'Vérification du prix…' : 'Choisissez vos dates pour voir le prix du séjour')}</span>}
          </div>
          <div className="w-10 h-10 shrink-0 rounded-full bg-gray-50 flex items-center justify-center text-haven-navy group-hover:bg-haven-red group-hover:text-white transition-all duration-300">
            <ArrowRight size={18} />
          </div>
        </div>
      </div>
    </Link>
    {recurrence && <div className="space-y-3 px-5 pb-5">
      <p className={`text-sm font-bold ${recurrence.availableCount === recurrence.periods.length ? 'text-green-700' : 'text-haven-navy'}`}>{recurrence.availableCount}/{recurrence.periods.length} séjours disponibles</p>
      <div className="flex flex-wrap gap-2" aria-label="Disponibilité de chaque séjour">
        {recurrence.periods.map((period, index) => period.stay ? <Link key={period.requested.start}
          to={recurringListingLink(listing.id, period.stay, requestedPeriods, flexibleDates)}
          title={`Séjour ${index + 1} : du ${formatDate(period.stay.start)} au ${formatDate(period.stay.end)}${period.offset ? ` (décalé de ${period.offset > 0 ? '+' : ''}${period.offset} jour)` : ''}`}
          className={`rounded-xl border px-3 py-2 text-xs font-semibold ${period.offset ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-green-100 bg-green-50 text-green-700'}`}>
            {formatDate(period.stay.start)}{period.offset ? ` (${period.offset > 0 ? '+' : ''}${period.offset} j)` : ''}<span className="sr-only"> · disponible, départ le {formatDate(period.stay.end)}</span>
          </Link> : period.minimumNightsRequired ? <span key={period.requested.start} title={`Du ${formatDate(period.requested.start)} au ${formatDate(period.requested.end)} : séjour trop court, ${period.minimumNightsRequired} nuits minimum pour ce logement`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{formatDate(period.requested.start)} · min. {period.minimumNightsRequired} nuits</span> : <span key={period.requested.start} title={`Du ${formatDate(period.requested.start)} au ${formatDate(period.requested.end)} : indisponible`} className="rounded-xl bg-gray-100 px-3 py-2 text-xs text-gray-500"><span className="line-through">{formatDate(period.requested.start)}</span><span className="sr-only"> · indisponible</span></span>)}
      </div>
      {recurrence.periods.some(period => period.minimumNightsRequired) && <p className="text-xs leading-relaxed text-amber-800">Les séjours indiqués « min. » sont trop courts pour ce logement. Cela ne signifie pas que les chambres sont occupées.</p>}
      <p className="text-xs text-gray-500">{recurrence.commonRoomIds.length ? `Même chambre possible sur ${recurrence.availableCount > 1 ? 'ces séjours' : 'ce séjour'}.` : 'Un changement de chambre est nécessaire entre certains séjours.'} Prix de la chambre disponible la moins chère à chaque séjour.</p>
      {completions.map(candidate => candidate && <Link key={`${candidate.listing.id}-${candidate.stay.start}`} to={recurringListingLink(candidate.listing.id, candidate.stay, requestedPeriods, flexibleDates)} className="block rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-xs leading-relaxed text-blue-800">
        Pour compléter : {formatDate(candidate.stay.start)} → {formatDate(candidate.stay.end)} disponible à {candidate.listing.title}{candidate.distance !== undefined ? ` · ${candidate.distance < 1 ? `${Math.round(candidate.distance * 1000)} m` : `${candidate.distance.toFixed(1)} km`} à vol d’oiseau` : ''}.
      </Link>)}
      {recurrence.availableCount < recurrence.periods.length && completions.filter(Boolean).length < recurrence.periods.length - recurrence.availableCount && <p className="text-xs text-gray-500">Certaines périodes manquantes n’ont pas de complément disponible dans les logements correspondant à tes filtres.</p>}
    </div>}
    </div>
  );
};
