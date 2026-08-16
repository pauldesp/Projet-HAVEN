
import React from 'react';
import { Listing } from '../types';
import { MapPin, Users, Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

interface ListingCardProps {
  listing: Listing;
}

export const ListingCard: React.FC<ListingCardProps> = ({ listing }) => {
  const minPrice = listing.rooms && listing.rooms.length > 0 
    ? Math.min(...listing.rooms.map(r => r.pricePerDay))
    : 0;
  const { t } = useLanguage();

  return (
    <Link 
      to={`/listing/${listing.id}`}
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
        {listing.isMixed && (
          <div className="absolute top-3 right-3 bg-haven-navy/10 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wider">
            {t('card.mixed')}
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
            {listing.availableRooms} {t('card.available')}
          </span>
          <span className="w-1 h-1 rounded-full bg-gray-200"></span>
          <span>{listing.surface}m²</span>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{t('card.from')}</span>
            <div className="flex items-baseline gap-1">
              <span className="font-heading font-bold text-xl text-haven-navy">{minPrice}€</span>
              <span className="text-gray-400 text-xs font-medium">/ jour</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-haven-navy group-hover:bg-haven-red group-hover:text-white transition-all duration-300">
            <ArrowRight size={18} />
          </div>
        </div>
      </div>
    </Link>
  );
};
