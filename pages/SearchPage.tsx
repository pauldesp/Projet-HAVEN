
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListingCard } from '../components/ListingCard';
import { BookingAvailability, Listing } from '../types';
import { MapPin, SlidersHorizontal, Check, Route, Loader2, ChevronDown, RotateCcw } from 'lucide-react';
import { useListings } from '../contexts/ListingContext';
import { resolveCityCoordinates, sortByDistance } from '../services/proximity';
import { Button } from '../components/Button';
import { listingHasAvailableRoom } from '../services/availability';
import { apiService } from '../services/api';
import { readSearchDates } from '../services/searchDates';
import { findClosestAvailableStay, NearbyStay } from '../services/nearbyStays';
import { countNights } from '../services/stay';
import { AMENITIES_LIST } from '../services/amenities';

interface ListingWithDistance extends Listing {
  distance?: number;
}

interface ListingWithNearbyStay extends Listing {
  nearbyStay: NearbyStay;
}

const ROOM_OPTIONS = [
  { id: 'hasPrivateBath', label: 'Salle de bain privée' },
  { id: 'hasDesk', label: 'Bureau' },
  { id: 'hasLock', label: 'Verrou porte' },
  { id: 'hasWardrobe', label: 'Armoire / dressing' },
] as const;

const FilterSection: React.FC<{
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, isOpen, onToggle, children }) => (
  <section className="border-t border-gray-100 first:border-t-0">
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between py-5 text-left">
      <span className="font-heading text-base font-bold text-haven-navy">{title}</span>
      <ChevronDown size={20} className={`text-haven-navy transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && <div className="pb-5">{children}</div>}
  </section>
);

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
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(5000);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [minRooms, setMinRooms] = useState(1);
  const [maxRooms, setMaxRooms] = useState(20);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [selectedRoomOptions, setSelectedRoomOptions] = useState<string[]>([]);
  const [openFilter, setOpenFilter] = useState<string | null>('PRICE');

  const stayNights = countNights(startDate, endDate) || 1;
  const listingStayPrice = (listing: Listing) => {
    const roomPrice = Math.min(...listing.rooms.map(room => room.pricePerDay)) * stayNights;
    return roomPrice + (Number(listing.cleaningFee) || 0) + Math.round(roomPrice * 0.15);
  };

  const priceCeiling = useMemo(() => {
    const highest = Math.max(0, ...allListings.filter(listing => listing.rooms?.length).map(listingStayPrice));
    return Math.max(100, Math.ceil(highest / 100) * 100);
  }, [allListings, stayNights]);

  const maxRoomCount = useMemo(() => Math.max(1, ...allListings.map(listing => listing.totalRooms || listing.rooms?.length || 1)), [allListings]);
  const sortedAmenities = useMemo(() => [...AMENITIES_LIST].sort((a, b) => a.id.localeCompare(b.id, 'fr')), []);
  const histogram = useMemo(() => {
    const bins = Array.from({ length: 20 }, () => 0);
    allListings.filter(listing => listing.rooms?.length).forEach(listing => {
      const index = Math.min(bins.length - 1, Math.floor((listingStayPrice(listing) / priceCeiling) * bins.length));
      bins[index] += 1;
    });
    const peak = Math.max(1, ...bins);
    return bins.map(value => Math.max(8, Math.round((value / peak) * 100)));
  }, [allListings, stayNights, priceCeiling]);

  useEffect(() => {
    setPriceMax(current => Math.min(current, priceCeiling));
    setPriceMin(current => Math.min(current, priceCeiling));
  }, [priceCeiling]);

  useEffect(() => {
    setMaxRooms(current => Math.min(current, maxRoomCount));
    setMinRooms(current => Math.min(current, maxRoomCount));
  }, [maxRoomCount]);

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
      const stayPrice = listingStayPrice(listing);
      if (stayPrice < priceMin || stayPrice > priceMax) return false;
      if (selectedTypes.length > 0 && !selectedTypes.includes(listing.type)) return false;
      const roomCount = listing.totalRooms || listing.rooms.length;
      if (roomCount < minRooms || roomCount > maxRooms) return false;
      if (selectedAmenities.some(amenity => !listing.amenities?.includes(amenity))) return false;
      if (selectedRoomOptions.length > 0 && !listing.rooms.some(room =>
        selectedRoomOptions.every(option => Boolean(room[option as keyof typeof room]))
      )) return false;
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
  }, [allListings, availability, cityParam, startDate, endDate, priceMin, priceMax, selectedTypes, minRooms, maxRooms, selectedAmenities, selectedRoomOptions, dynamicCityCoords]);

  const toggleType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(previous => previous.includes(amenity) ? previous.filter(item => item !== amenity) : [...previous, amenity]);
  };

  const toggleRoomOption = (option: string) => {
    setSelectedRoomOptions(previous => previous.includes(option) ? previous.filter(item => item !== option) : [...previous, option]);
  };

  const resetFilters = () => {
    setPriceMin(0);
    setPriceMax(priceCeiling);
    setSelectedTypes([]);
    setMinRooms(1);
    setMaxRooms(maxRoomCount);
    setSelectedAmenities([]);
    setSelectedRoomOptions([]);
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
            <div className="mb-2 flex items-center justify-between gap-3 text-haven-navy">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={20} />
                <h2 className="font-bold text-lg">Ajuster ma recherche</h2>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs font-bold text-haven-red transition-opacity hover:opacity-70"
              >
                <RotateCcw size={14} /> Réinitialiser
              </button>
            </div>

            <FilterSection title="Prix du séjour" isOpen={openFilter === 'PRICE'} onToggle={() => setOpenFilter(openFilter === 'PRICE' ? null : 'PRICE')}>
              <p className="text-sm text-gray-500">{stayNights} nuit{stayNights > 1 ? 's' : ''}, tous frais compris</p>
              <div className="mt-5 flex h-20 items-end gap-0.5 px-1" aria-hidden="true">
                {histogram.map((height, index) => (
                  <span key={index} className="flex-1 rounded-t-sm bg-haven-red" style={{ height: `${height}%` }} />
                ))}
              </div>
              <div className="mt-2 space-y-2">
                <label className="sr-only" htmlFor="price-min">Prix minimum du séjour</label>
                <input
                  id="price-min"
                  type="range"
                  min="0"
                  max={priceCeiling}
                  step="10"
                  value={priceMin}
                  onChange={(event) => setPriceMin(Math.min(Number(event.target.value), priceMax))}
                  className="block w-full accent-haven-red"
                />
                <label className="sr-only" htmlFor="price-max">Prix maximum du séjour</label>
                <input
                  id="price-max"
                  type="range"
                  min="0"
                  max={priceCeiling}
                  step="10"
                  value={priceMax}
                  onChange={(event) => setPriceMax(Math.max(Number(event.target.value), priceMin))}
                  className="block w-full accent-haven-red"
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <label className="text-gray-500">Minimum
                  <input type="number" min="0" max={priceMax} value={priceMin} onChange={(event) => setPriceMin(Math.min(Math.max(0, Number(event.target.value)), priceMax))} className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2 font-bold text-haven-navy" />
                </label>
                <label className="text-right text-gray-500">Maximum
                  <input type="number" min={priceMin} max={priceCeiling} value={priceMax} onChange={(event) => setPriceMax(Math.max(priceMin, Math.min(priceCeiling, Number(event.target.value))))} className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2 text-right font-bold text-haven-navy" />
                </label>
              </div>
            </FilterSection>

            <FilterSection title="Type de logement" isOpen={openFilter === 'TYPE'} onToggle={() => setOpenFilter(openFilter === 'TYPE' ? null : 'TYPE')}>
              <div className="space-y-3">
                {[
                  { id: 'APARTMENT', label: 'Appartement' },
                  { id: 'HOUSE', label: 'Maison' },
                ].map(type => (
                  <label key={type.id} className="flex cursor-pointer items-center gap-3 text-sm font-medium text-gray-700">
                    <input type="checkbox" checked={selectedTypes.includes(type.id)} onChange={() => toggleType(type.id)} className="h-4 w-4 rounded border-gray-300 accent-haven-red" />
                    {type.label}
                  </label>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Taille de la colocation" isOpen={openFilter === 'SIZE'} onToggle={() => setOpenFilter(openFilter === 'SIZE' ? null : 'SIZE')}>
              <p className="mb-3 text-sm text-gray-500">Nombre de chambres dans le logement</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-gray-500">Minimum
                  <select value={minRooms} onChange={(event) => setMinRooms(Math.min(Number(event.target.value), maxRooms))} className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-haven-navy">
                    {Array.from({ length: maxRoomCount }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-xs font-bold text-gray-500">Maximum
                  <select value={maxRooms} onChange={(event) => setMaxRooms(Math.max(Number(event.target.value), minRooms))} className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-haven-navy">
                    {Array.from({ length: maxRoomCount }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              </div>
            </FilterSection>

            <FilterSection title="Équipements souhaités" isOpen={openFilter === 'AMENITIES'} onToggle={() => setOpenFilter(openFilter === 'AMENITIES' ? null : 'AMENITIES')}>
              <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                {sortedAmenities.map(amenity => (
                  <label key={amenity.id} className="flex cursor-pointer items-center gap-3 text-sm font-medium text-gray-700">
                    <input type="checkbox" checked={selectedAmenities.includes(amenity.id)} onChange={() => toggleAmenity(amenity.id)} className="h-4 w-4 rounded border-gray-300 accent-haven-red" />
                    {amenity.id}
                  </label>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Options de la chambre" isOpen={openFilter === 'ROOM'} onToggle={() => setOpenFilter(openFilter === 'ROOM' ? null : 'ROOM')}>
              <div className="space-y-3">
                {ROOM_OPTIONS.map(option => (
                  <label key={option.id} className="flex cursor-pointer items-center gap-3 text-sm font-medium text-gray-700">
                    <input type="checkbox" checked={selectedRoomOptions.includes(option.id)} onChange={() => toggleRoomOption(option.id)} className="h-4 w-4 rounded border-gray-300 accent-haven-red" />
                    {option.label}
                  </label>
                ))}
              </div>
            </FilterSection>
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
                    onClick={resetFilters}
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
