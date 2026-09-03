
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListingCard } from '../components/ListingCard';
import { Listing } from '../types';
import { MapPin, SlidersHorizontal, Check, Route, Loader2, Search, X } from 'lucide-react';
import { useListings } from '../contexts/ListingContext';
import { City, cityLabel, exactCity, findCities, loadCities, normalizeCity } from '../services/cities';
import { Button } from '../components/Button';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { distanceKm, nearbyListings } from '../services/proximity';

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  return distanceKm({lat: lat1, lng: lon1}, {lat: lat2, lng: lon2});
}

interface ListingWithDistance extends Listing {
  distance?: number;
}

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const cityParam = searchParams.get('city') || '';
  
  // Consommation du contexte global
  const { listings: allListings, isLoading: listingsLoading, error: listingsError } = useListings();

  // Dynamic Geocoding State
  const [dynamicCityCoords, setDynamicCityCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [resolvedCity, setResolvedCity] = useState<City | null>(null);
  const [citySuggestions, setCitySuggestions] = useState<City[]>([]);
  const [cityError, setCityError] = useState('');
  const cityName = resolvedCity?.nom || cityParam.split(',')[0];
  
  // Local Filter State
  const [priceRange, setPriceRange] = useState(300);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isMixedOnly, setIsMixedOnly] = useState(false);
  const [draftCity, setDraftCity] = useState(cityParam);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  useEffect(() => setDraftCity(cityParam), [cityParam]);

  const submitCity = (event: React.FormEvent) => {
    event.preventDefault();
    const nextParams = new URLSearchParams(searchParams);
    if (draftCity.trim()) nextParams.set('city', draftCity.trim());
    else nextParams.delete('city');
    setSearchParams(nextParams);
  };

  const activeFilterCount = selectedTypes.length + (isMixedOnly ? 1 : 0) + (priceRange !== 300 ? 1 : 0);

  // Fetch Coordinates when city changes
  useEffect(() => {
    let cancelled = false;
    setDynamicCityCoords(null); setResolvedCity(null); setCitySuggestions([]); setCityError('');
    setIsGeocoding(Boolean(cityParam));
    if (!cityParam) return;
    loadCities().then(cities => {
      if (cancelled) return;
      const city = exactCity(cities, cityParam);
      setResolvedCity(city);
      if (city?.centre) {
        const [lng, lat] = city.centre.coordinates;
        setDynamicCityCoords({ lat, lng });
      } else {
        setCitySuggestions(findCities(cities, cityParam));
        setCityError('Choisissez une commune ci-dessous ou précisez son nom et son code postal pour rechercher à proximité.');
      }
    }).catch(() => { if (!cancelled) setCityError('La localisation est momentanément indisponible. Vérifiez votre connexion puis actualisez la page pour relancer la recherche.'); })
      .finally(() => { if (!cancelled) setIsGeocoding(false); });
    return () => { cancelled = true; };
  }, [cityParam]);

  // Filter Logic
  const { exactMatches, nearbyMatches, isFallbackMode } = useMemo(() => {
    // 0. Security Filter: ONLY APPROVED LISTINGS
    const approvedListings = allListings.filter(l => l.status === 'APPROVED');

    // 1. Base Filtering (Prix, Type, Mixité)
    const baseListings = approvedListings.filter(listing => {
      // Handle case where rooms might be empty
      if (!listing.rooms || listing.rooms.length === 0) return false;
      
      const minRoomPrice = Math.min(...listing.rooms.map(r => r.pricePerDay));
      // Comparison logic: priceRange is weekly, rooms are daily. 
      // 300€/week is roughly 42€/day. 
      // We should probably convert priceRange to daily for comparison or vice versa.
      const dailyPriceLimit = priceRange / 7;
      if (minRoomPrice > dailyPriceLimit + 5) return false; // Added +5 margin for flexibility
      
      if (selectedTypes.length > 0 && !selectedTypes.includes(listing.type)) return false;
      if (isMixedOnly && !listing.isMixed) return false;
      return true;
    });

    const normalizedParam = normalizeCity(cityParam.split(',')[0]);

    // 2. Exact City Match (Available only)
    const exactMatches = baseListings.filter(listing => {
      if (listing.availableRooms <= 0) return false;
      if (!normalizedParam) return true;
      
      if (normalizeCity(listing.city) !== normalizedParam) return false;
      // Existing listings have no commune code: reject distant namesakes using coordinates.
      if (dynamicCityCoords && Number.isFinite(listing.coordinates?.lat) && Number.isFinite(listing.coordinates?.lng)) {
        return getDistanceFromLatLonInKm(dynamicCityCoords.lat, dynamicCityCoords.lng, listing.coordinates.lat, listing.coordinates.lng) <= 50;
      }
      return !cityError;
    });

    // 3. Proximity Search (only available listings not in exactMatches)
    let nearbyMatches: ListingWithDistance[] = [];
    if (cityParam && dynamicCityCoords) {
      nearbyMatches = nearbyListings(baseListings, dynamicCityCoords, new Set(exactMatches.map(listing => listing.id)));
    }

    return { 
      exactMatches, 
      nearbyMatches,
      isFallbackMode: exactMatches.length === 0 && nearbyMatches.length > 0 
    };
  }, [allListings, cityParam, cityError, priceRange, selectedTypes, isMixedOnly, dynamicCityCoords]);

  const toggleType = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="min-h-screen bg-haven-cream pt-4 pb-20 md:pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <form onSubmit={submitCity} className="sticky top-16 z-30 -mx-4 mb-6 border-b border-gray-100 bg-haven-cream/95 px-4 py-3 backdrop-blur-xl md:static md:mx-0 md:mb-8 md:border-0 md:bg-transparent md:p-0">
          <div className="flex items-center gap-2">
            <div className="h-14 min-w-0 flex-1 rounded-2xl border border-gray-100 bg-white px-4 shadow-soft">
              <CityAutocomplete value={draftCity} onChange={setDraftCity} placeholder="Dans quelle ville ?" />
            </div>
            <button type="submit" aria-label="Lancer la recherche" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-haven-red text-white shadow-lg shadow-haven-red/20 active:scale-95">
              <Search size={21} />
            </button>
            <button
              type="button"
              onClick={() => setIsFiltersOpen(true)}
              aria-label="Ouvrir les filtres"
              className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-white text-haven-navy shadow-soft lg:hidden"
            >
              <SlidersHorizontal size={21} />
              {activeFilterCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-haven-red px-1 text-[10px] font-black text-white">{activeFilterCount}</span>}
            </button>
          </div>
        </form>

        {/* Top Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-4">
            <h1 className="font-heading font-bold text-2xl md:text-3xl text-haven-navy">
              {cityParam ? `Logements à ${cityName}` : 'Chercher mon logement'}
            </h1>
            {isGeocoding && <Loader2 className="animate-spin text-haven-stone" size={24} />}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {isGeocoding || listingsLoading ? 'Recherche en cours…' : cityError ? 'Commune à préciser ou localisation indisponible' : `${exactMatches.length + nearbyMatches.length} logement(s) disponible(s)`}
          </p>
        </div>

        {listingsError && <p role="alert" className="mb-6 rounded-2xl bg-orange-50 p-4 text-sm text-orange-900">{listingsError}</p>}

        {cityError && !isGeocoding && <div role="status" className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-haven-navy">
          <p>{cityError}</p>
          <div className="mt-3 flex flex-wrap gap-2">{citySuggestions.map(city => <button type="button" key={city.code} className="rounded-xl border border-blue-200 bg-white px-4 py-3 font-bold" onClick={() => { const next = new URLSearchParams(searchParams); next.set('city', cityLabel(city)); setSearchParams(next); }}>{cityLabel(city)}</button>)}</div>
        </div>}

        {/* Banner: No exact matches fallback */}
        {!isGeocoding && !listingsLoading && !listingsError && resolvedCity && exactMatches.length === 0 && cityParam && (
          <div className="mb-8 bg-orange-50 border border-orange-200 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 animate-fade-in-up">
            <div className="bg-orange-100 p-4 rounded-2xl text-orange-600">
              <MapPin size={32} />
            </div>
            <div>
              <h3 className="font-bold text-orange-900 text-lg">Aucun logement disponible à {cityName} pour vos critères</h3>
              <p className="text-orange-800/70 text-sm mt-1 max-w-2xl">
                {nearbyMatches.length ? 'Voici les colocations disponibles dans un rayon de 50 km, classées de la plus proche à la plus éloignée. Les distances sont à vol d’oiseau depuis le centre de la commune.' : 'Aucune colocation ne correspond non plus à vos critères dans un rayon de 50 km. Vous pouvez modifier vos filtres ou chercher dans une autre commune.'}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          {isFiltersOpen && <button aria-label="Fermer les filtres" className="fixed inset-0 z-40 bg-haven-navy/25 backdrop-blur-sm lg:hidden" onClick={() => setIsFiltersOpen(false)} />}
          {/* Sidebar Filters */}
          <aside className={`${isFiltersOpen ? 'fixed inset-x-0 bottom-0 z-50 block max-h-[80dvh] overflow-y-auto rounded-t-[2rem]' : 'hidden'} w-full bg-white p-6 shadow-premium border border-gray-100 lg:sticky lg:top-24 lg:block lg:h-fit lg:w-1/4 lg:rounded-3xl`}>
            <div className="flex items-center justify-between gap-2 mb-6 text-haven-navy">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={20} />
                <h2 className="font-bold text-lg">Filtres</h2>
              </div>
              <button type="button" aria-label="Fermer" className="rounded-full bg-gray-50 p-2 lg:hidden" onClick={() => setIsFiltersOpen(false)}><X size={20} /></button>
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

            {/* Mixed Filter */}
            <div className="pt-6 border-t border-gray-50">
               <label className="flex items-center cursor-pointer group">
                  <div className={`w-10 h-6 rounded-full p-1 transition-all ${isMixedOnly ? 'bg-haven-navy' : 'bg-gray-100'}`} onClick={() => setIsMixedOnly(!isMixedOnly)}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${isMixedOnly ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <span className="ml-3 text-xs font-bold text-gray-500 group-hover:text-haven-navy transition-colors">Colocation mixte</span>
               </label>
            </div>
            <button type="button" onClick={() => setIsFiltersOpen(false)} className="mt-8 h-12 w-full rounded-2xl bg-haven-navy text-sm font-bold text-white lg:hidden">
              Voir {exactMatches.length + nearbyMatches.length} résultat(s)
            </button>
          </aside>

          {/* Results Grid */}
          <div className="w-full lg:w-3/4 space-y-12">
            {exactMatches.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-100"></div>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">{cityParam ? `Logements à ${cityName}` : 'Logements disponibles'}</h2>
                  <div className="h-px flex-1 bg-gray-100"></div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 md:gap-8">
                  {exactMatches.map(listing => (
                    <ListingCard key={listing.id} listing={listing} />
                  ))}
                </div>
              </div>
            )}

            {nearbyMatches.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-100"></div>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">À proximité · 50 km maximum</h2>
                  <div className="h-px flex-1 bg-gray-100"></div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 md:gap-8">
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

            {!isGeocoding && !listingsLoading && !listingsError && !cityError && exactMatches.length === 0 && nearbyMatches.length === 0 && (
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
                    onClick={() => { setPriceRange(500); setSelectedTypes([]); setIsMixedOnly(false); }}
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
