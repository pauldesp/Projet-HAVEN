
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListingCard } from '../components/ListingCard';
import { Listing } from '../types';
import { MapPin, SlidersHorizontal, Check, Info, Route, Loader2, AlertCircle } from 'lucide-react';
import { useListings } from '../contexts/ListingContext';
import { aiService } from '../services/ai';
import { auth, seedFirestore } from '../firebase';
import { Button } from '../components/Button';
import { toast } from 'sonner';

// --- Utilitaires de Géolocalisation Mockés ---
const MOCK_CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "paris": { lat: 48.8566, lng: 2.3522 },
  "lyon": { lat: 45.7640, lng: 4.8357 },
  "bordeaux": { lat: 44.8378, lng: -0.5792 },
  "jouy-en-josas": { lat: 48.7667, lng: 2.1667 },
  "marseille": { lat: 43.2965, lng: 5.3698 },
  "lille": { lat: 50.6292, lng: 3.0573 },
  "nantes": { lat: 47.2184, lng: -1.5536 },
  "strasbourg": { lat: 48.5734, lng: 7.7521 },
  "montpellier": { lat: 43.6108, lng: 3.8767 },
  "toulouse": { lat: 43.6047, lng: 1.4442 },
  "nice": { lat: 43.7102, lng: 7.2620 },
  "versailles": { lat: 48.8014, lng: 2.1301 },
};

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat1)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; 
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

interface ListingWithDistance extends Listing {
  distance?: number;
}

export const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const cityParam = searchParams.get('city') || '';
  
  // Consommation du contexte global
  const { listings: allListings } = useListings();

  // Dynamic Geocoding State
  const [dynamicCityCoords, setDynamicCityCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  // Local Filter State
  const [priceRange, setPriceRange] = useState(300);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isMixedOnly, setIsMixedOnly] = useState(false);

  // Fetch Coordinates when city changes
  useEffect(() => {
    if (!cityParam) {
      setDynamicCityCoords(null);
      return;
    }
    
    const normalizedCity = cityParam.split(',')[0].trim().toLowerCase();
    if (MOCK_CITY_COORDINATES[normalizedCity]) {
      setDynamicCityCoords(MOCK_CITY_COORDINATES[normalizedCity]);
      return;
    }

    // Fetch from AI
    setIsGeocoding(true);
    aiService.getCityCoordinates(cityParam)
      .then(coords => {
        if (coords) setDynamicCityCoords(coords);
        else setDynamicCityCoords(null);
      })
      .catch(() => setDynamicCityCoords(null))
      .finally(() => setIsGeocoding(false));
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

    const normalizedParam = cityParam.split(',')[0].trim().toLowerCase();

    // 2. Exact City Match (Available only)
    const exactMatches = baseListings.filter(listing => {
      if (listing.availableRooms <= 0) return false;
      if (!normalizedParam) return true;
      
      const listingCityNormalized = listing.city.toLowerCase().trim();
      const searchParamNormalized = normalizedParam.toLowerCase().trim();
      
      // Exact match OR the search param contains the city name OR city name contains search param
      return listingCityNormalized.includes(searchParamNormalized) || 
             searchParamNormalized.includes(listingCityNormalized);
    });

    // 3. Proximity Search (only available listings not in exactMatches)
    let nearbyMatches: ListingWithDistance[] = [];
    if (cityParam && dynamicCityCoords) {
      nearbyMatches = baseListings
        .filter(listing => listing.availableRooms > 0 && !exactMatches.find(em => em.id === listing.id))
        .map(listing => ({
          ...listing,
          distance: getDistanceFromLatLonInKm(
            dynamicCityCoords.lat, 
            dynamicCityCoords.lng, 
            listing.coordinates.lat, 
            listing.coordinates.lng
          )
        }))
        .sort((a, b) => (a.distance || 0) - (b.distance || 0));
      // Distance limit removed as requested
    }

    return { 
      exactMatches, 
      nearbyMatches,
      isFallbackMode: exactMatches.length === 0 && nearbyMatches.length > 0 
    };
  }, [allListings, cityParam, priceRange, selectedTypes, isMixedOnly, dynamicCityCoords]);

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
            {exactMatches.length + nearbyMatches.length} logement(s) disponible(s) 
          </p>
        </div>

        {/* Banner: No exact matches fallback */}
        {exactMatches.length === 0 && nearbyMatches.length > 0 && cityParam && (
          <div className="mb-8 bg-orange-50 border border-orange-200 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 animate-fade-in-up">
            <div className="bg-orange-100 p-4 rounded-2xl text-orange-600">
              <MapPin size={32} />
            </div>
            <div>
              <h3 className="font-bold text-orange-900 text-lg">Pas de logement disponible exactement à "{cityParam.split(',')[0]}"</h3>
              <p className="text-orange-800/70 text-sm mt-1 max-w-2xl">
                C'est le moment d'être explorateur ! Nous n'avons pas de colocations à cette adresse précise, 
                mais voici les meilleures options disponibles à proximité immédiate.
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

            {/* Mixed Filter */}
            <div className="pt-6 border-t border-gray-50">
               <label className="flex items-center cursor-pointer group">
                  <div className={`w-10 h-6 rounded-full p-1 transition-all ${isMixedOnly ? 'bg-haven-navy' : 'bg-gray-100'}`} onClick={() => setIsMixedOnly(!isMixedOnly)}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${isMixedOnly ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <span className="ml-3 text-xs font-bold text-gray-500 group-hover:text-haven-navy transition-colors">Colocation mixte</span>
               </label>
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
                        À {Math.round(listing.distance || 0)} km
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {exactMatches.length === 0 && nearbyMatches.length === 0 && (
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
