
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListingCard } from '../components/ListingCard';
import { BookingAvailability, Listing } from '../types';
import { MapPin, SlidersHorizontal, Check, Info, Route, Loader2, AlertCircle } from 'lucide-react';
import { useListings } from '../contexts/ListingContext';
import { resolveCityCoordinates, sortByDistance } from '../services/proximity';
import { auth, seedFirestore } from '../firebase';
import { Button } from '../components/Button';
import { toast } from 'sonner';
import { isRoomAvailableForStay, listingHasAvailableRoom } from '../services/availability';
import { apiService } from '../services/api';
import { readSearchDates } from '../services/searchDates';
import { findClosestAvailableStay, NearbyStay } from '../services/nearbyStays';

interface ListingWithDistance extends Listing {
  distance?: number;
}

interface ListingWithNearbyStay extends Listing {
  nearbyStay: NearbyStay;
}

export const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const cityParam = searchParams.get('city') || '';
  const cityCode = searchParams.get('cityCode') || '';
  const { start: startDate, end: endDate } = readSearchDates(searchParams);
  const [geocodingError, setGeocodingError] = useState(false);
  
  // Consommation du contexte global
  const { listings: allListings, isLoading: listingsLoading, error: listingsError } = useListings();
  const [availability, setAvailability] = useState<BookingAvailability[]>([]);
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(Boolean(startDate || endDate));

  useEffect(() => {
    if (!startDate && !endDate) {
      setIsAvailabilityLoading(false);
      return;
    }
    setIsAvailabilityLoading(true);
    return apiService.availability.listenAll(items => {
      setAvailability(items);
      setIsAvailabilityLoading(false);
    });
  }, [startDate, endDate]);

  // Dynamic Geocoding State
  const [dynamicCityCoords, setDynamicCityCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  // Local Filter State
  const [priceRange, setPriceRange] = useState(300);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setDynamicCityCoords(null);
    setGeocodingError(false);
    setIsGeocoding(Boolean(cityParam));
    if (!cityParam) return () => controller.abort();
    resolveCityCoordinates(cityParam, cityCode, controller.signal)
      .then(coords => { if (!controller.signal.aborted) setDynamicCityCoords(coords); })
      .catch(() => { if (!controller.signal.aborted) setGeocodingError(true); })
      .finally(() => { if (!controller.signal.aborted) setIsGeocoding(false); });
    return () => controller.abort();
  }, [cityParam, cityCode]);

  // Filter Logic
  const { exactMatches, nearbyDateMatches, nearbyMatches } = useMemo(() => {
    // 0. Security Filter: ONLY APPROVED LISTINGS
    const approvedListings = allListings.filter(l => l.status === 'APPROVED');

    // 1. Filters independent from the requested dates. They are also used for
    // the “nearby dates” section below.
    const listingsMatchingFilters = approvedListings.filter(listing => {
      // Handle case where rooms might be empty
      if (!listing.rooms || listing.rooms.length === 0) return false;
      const minRoomPrice = Math.min(...listing.rooms.map(room => room.pricePerDay));
      // Comparison logic: priceRange is weekly, rooms are daily. 
      // 300€/week is roughly 42€/day. 
      // We should probably convert priceRange to daily for comparison or vice versa.
      const dailyPriceLimit = priceRange / 7;
      if (minRoomPrice > dailyPriceLimit + 5) return false; // Added +5 margin for flexibility
      
      if (selectedTypes.length > 0 && !selectedTypes.includes(listing.type)) return false;
      return true;
    });

    const normalizedParam = cityParam.split(',')[0].trim().toLowerCase();
    const isInRequestedCity = (listing: Listing) => {
      if (!normalizedParam) return true;
      const listingCityNormalized = listing.city.toLowerCase().trim();
      return listingCityNormalized.includes(normalizedParam) || normalizedParam.includes(listingCityNormalized);
    };
    const isAvailableForRequestedStay = (listing: Listing) =>
      listingHasAvailableRoom(listing, availability, startDate, endDate);

    // 2. Exact city and exact requested stay.
    const exactCityListings = listingsMatchingFilters.filter(isInRequestedCity);
    const exactMatches = exactCityListings.filter(isAvailableForRequestedStay);

    // 3. Same city, same duration, at the closest available dates. This section
    // comes after exact results and never replaces them.
    const nearbyDateMatches: ListingWithNearbyStay[] = startDate && endDate
      ? exactCityListings
        .filter(listing => !isAvailableForRequestedStay(listing))
        .flatMap(listing => {
          const nearbyStay = findClosestAvailableStay(listing, availability, startDate, endDate);
          return nearbyStay ? [{ ...listing, nearbyStay }] : [];
        })
        .sort((a, b) => Math.abs(a.nearbyStay.offsetDays) - Math.abs(b.nearbyStay.offsetDays))
      : [];

    // 4. Proximity search keeps the exact dates and excludes the city already
    // shown in the first two sections.
    let nearbyMatches: ListingWithDistance[] = [];
    if (cityParam && dynamicCityCoords) {
      nearbyMatches = sortByDistance(
        listingsMatchingFilters.filter(listing => isAvailableForRequestedStay(listing) && !isInRequestedCity(listing)),
        dynamicCityCoords
      );
      // Distance limit removed as requested
    }

    return { 
      exactMatches, 
      nearbyMatches,
      nearbyDateMatches,
    };
  }, [allListings, availability, cityParam, startDate, endDate, priceRange, selectedTypes, dynamicCityCoords]);

  const toggleType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="min-h-screen bg-haven-cream pt-8 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <h1 className="font-heading font-bold text-3xl text-haven-navy">
              {exactMatches.length > 0 ? `Logements à ${cityParam.split(',')[0]}` : 'Chercher mon logement'}
            </h1>
            {isGeocoding && <Loader2 className="animate-spin text-haven-stone" size={24} />}
          </div>
          <p className="text-gray-500">
            {exactMatches.length + nearbyMatches.length} logement(s) disponible(s) aux dates demandées
          </p>
        </div>

        {/* Banner: Exact dates are unavailable in the requested city */}
        {exactMatches.length === 0 && cityParam && (nearbyDateMatches.length > 0 || nearbyMatches.length > 0) && (
          <div className="mb-8 bg-orange-50 border border-orange-200 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 animate-fade-in-up">
            <div className="bg-orange-100 p-4 rounded-2xl text-orange-600">
              <MapPin size={32} />
            </div>
            <div>
              <h3 className="font-bold text-orange-900 text-lg">Aucun logement libre à "{cityParam.split(',')[0]}" pour ces dates</h3>
              <p className="text-orange-800/70 text-sm mt-1 max-w-2xl">
                Découvrez d’abord les disponibilités à des dates proches dans cette ville, puis les logements des villes voisines aux dates demandées.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className="w-full lg:w-1/4 h-fit bg-white p-6 rounded-3xl shadow-premium border border-gray-100 sticky top-24">
            <div className="flex items-center gap-2 mb-6 text-haven-navy">
              <SlidersHorizontal size={20} />
              <h2 className="font-bold text-lg">Ajuster ma recherche</h2>
            </div>

            {/* Price Filter */}
            <div className="mb-8">
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
                Budget / semaine : <span className="text-haven-navy">{priceRange}€</span>
              </label>
              <input 
                type="range" 
                min="100" 
                max="1000" 
                step="10" 
                value={priceRange} 
                onChange={(e) => setPriceRange(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-haven-navy"
              />
              <div className="flex justify-between text-[9px] font-bold text-gray-300 mt-2">
                <span>100€</span>
                <span>1000€</span>
              </div>
            </div>

            {/* Type Filter */}
            <div className="mb-8">
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Type de bien</label>
              <div className="space-y-3">
                {[
                  { id: 'APARTMENT', label: 'Appartement' },
                  { id: 'HOUSE', label: 'Maison' }
                ].map(type => (
                  <div key={type.id} className="flex items-center cursor-pointer group" onClick={() => toggleType(type.id)}>
                     <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center mr-3 transition-all ${selectedTypes.includes(type.id) ? 'bg-haven-navy border-haven-navy shadow-lg shadow-haven-navy/20' : 'border-gray-200 group-hover:border-haven-navy/30'}`}>
                        {selectedTypes.includes(type.id) && <Check size={12} className="text-white stroke-[3px]"/>}
                     </div>
                     <span className={`text-sm font-bold transition-colors ${selectedTypes.includes(type.id) ? 'text-haven-navy' : 'text-gray-400 group-hover:text-gray-600'}`}>{type.label}</span>
                  </div>
                ))}
              </div>
            </div>

          </aside>

          {/* Results Grid */}
          <div className="w-full lg:w-3/4 space-y-12">
            {exactMatches.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-100"></div>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Logements à {cityParam.split(',')[0]}</h2>
                  <div className="h-px flex-1 bg-gray-100"></div>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  {exactMatches.map(listing => (
                    <ListingCard key={listing.id} listing={listing} />
                  ))}
                </div>
              </div>
            )}

            {nearbyDateMatches.length > 0 && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5">
                  <h2 className="font-heading font-bold text-lg text-haven-navy">Disponibles à des dates proches</h2>
                  <p className="mt-1 text-sm text-gray-600">Même durée de séjour, dans la ville recherchée. Sélectionnez une proposition pour utiliser ses dates.</p>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  {nearbyDateMatches.map(listing => {
                    const { nearbyStay } = listing;
                    const label = `Du ${new Date(`${nearbyStay.startDate}T12:00:00`).toLocaleDateString('fr-FR')} au ${new Date(`${nearbyStay.endDate}T12:00:00`).toLocaleDateString('fr-FR')}`;
                    return <ListingCard key={listing.id} listing={listing} stayOverride={{ start: nearbyStay.startDate, end: nearbyStay.endDate, label }} />;
                  })}
                </div>
              </div>
            )}

            {nearbyMatches.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-100"></div>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">À proximité</h2>
                  <div className="h-px flex-1 bg-gray-100"></div>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  {nearbyMatches.map(listing => (
                    <div key={listing.id} className="relative">
                      <ListingCard listing={listing} />
                      <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm text-haven-navy px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 border border-gray-100">
                        <Route size={14} className="text-haven-red" />
                        À {Math.round(listing.distance || 0)} km à vol d’oiseau
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(isGeocoding || listingsLoading || isAvailabilityLoading) && <p role="status" className="text-gray-500">Recherche des logements disponibles…</p>}
            {listingsError && <p role="alert" className="text-haven-red">{listingsError}</p>}
            {geocodingError && <p role="alert" className="text-haven-red">La localisation de cette ville est indisponible. Réessayez la recherche pour afficher les logements à proximité.</p>}
            {!isGeocoding && !listingsLoading && !isAvailabilityLoading && !listingsError && !geocodingError && exactMatches.length === 0 && nearbyDateMatches.length === 0 && nearbyMatches.length === 0 && (
              <div className="text-center py-24 bg-white rounded-[3rem] border border-gray-100 shadow-premium">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <MapPin size={40} className="text-gray-200" />
                </div>
                <h3 className="font-heading font-bold text-2xl text-haven-navy mb-2">Aucun logement trouvé</h3>
                <p className="text-gray-400 max-w-sm mx-auto mb-8 text-sm leading-relaxed">Nous n'avons pas encore de colocations disponibles pour ces critères précis dans ce secteur.</p>
                <div className="flex flex-col items-center gap-4">
                  <Button 
                    variant="outline" 
                    className="rounded-2xl px-8 h-12 text-[10px] font-black uppercase tracking-widest"
                    onClick={() => { setPriceRange(500); setSelectedTypes([]); }}
                  >
                    Réinitialiser les filtres
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
