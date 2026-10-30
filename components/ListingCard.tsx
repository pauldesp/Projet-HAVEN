import { cheapestStayPrice } from '../services/stayPrice';
import { isRoomAvailableForStay } from '../services/availability';

import React from 'react';
import { Listing, BookingAvailability } from '../types';
import { MapPin, Users, Star, ArrowRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { readSearchDates } from '../services/searchDates';

interface ListingCardProps {
  listing: Listing;
  availability?: BookingAvailability[];
  stayOverride?: { start: string; end: string; label?: string };
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing, stayOverride, availability }) => {
  const { t, tr, locale } = useLanguage();
  const [searchParams] = useSearchParams();
  const stayParams = new URLSearchParams();
  const dates = stayOverride || readSearchDates(searchParams);
  const rooms = availability && dates.start && dates.end ? listing.rooms.filter(room => isRoomAvailableForStay(room, listing, availability, dates.start, dates.end)) : listing.rooms;
  const quote = availability ? cheapestStayPrice(listing, availability, dates.start, dates.end) : null;
  const money = (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(amount);
  if (dates.start) stayParams.set('start', dates.start);
  if (dates.end) stayParams.set('end', dates.end);
  const stayQuery = stayParams.toString();

  return (
    <Link 
      to={`/listing/${listing.id}${stayQuery ? `?${stayQuery}` : ''}`}
      className="group flex flex-col bg-white rounded-[2rem] p-3 transition-all duration-300 border border-transparent hover:border-gray-100 hover:shadow-2xl hover:-translate-y-1"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl mb-4">
        <img 
          src={listing.mainPhotoUrl} 
          alt={listing.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-haven-navy uppercase tracking-wider shadow-sm">
          {listing.type === 'HOUSE' ? 'Maison' : 'Appartement'}
        </div>
        {stayOverride?.label && (
          <div className="absolute bottom-3 left-3 bg-haven-navy/95 px-3 py-1.5 rounded-full text-[10px] font-bold text-white shadow-sm">
            {stayOverride.label}
          </div>
        )}
      </div>

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

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex flex-col">
            {quote ? <>
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{t('card.from')}</span>
              <span className="font-heading font-bold text-xl text-haven-navy">{money(quote.total)} <span className="text-sm font-medium">{tr('au total')}</span></span>
              <span className="mt-1 text-xs text-gray-500">{quote.nights} {tr(quote.nights === 1 ? 'nuit · frais inclus' : 'nuits · frais inclus')}</span>
            </> : <span className="text-sm font-semibold text-haven-navy">{tr(dates.start && dates.end ? availability ? 'Indisponible pour ces dates' : 'Vérification du prix…' : 'Choisissez vos dates pour voir le prix du séjour')}</span>}
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-haven-navy group-hover:bg-haven-red group-hover:text-white transition-all duration-300">
            <ArrowRight size={18} />
          </div>
        </div>
      </div>
    </Link>
  );
};
