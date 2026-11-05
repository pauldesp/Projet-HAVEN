import { CityAutocomplete } from '../components/CityAutocomplete';
import { DateRangePicker } from '../components/DateRangePicker';
import { SearchLoading } from '../components/SearchLoading';
import { cheapestStayPrice } from '../services/stayPrice';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ListingCard } from '../components/ListingCard';
import { BookingAvailability, Listing } from '../types';
import { MapPin, SlidersHorizontal, Route, Loader2, ChevronDown, RotateCcw, ArrowLeft, Search, X } from 'lucide-react';
import { useListings } from '../contexts/ListingContext';
import { resolveCityCoordinates, sortByDistance } from '../services/proximity';
import { Button } from '../components/Button';
import { listingHasAvailableRoom } from '../services/availability';
import { apiService } from '../services/api';
import { readSearchDates } from '../services/searchDates';
import { findClosestAvailableStay, NearbyStay } from '../services/nearbyStays';
import { countNights } from '../services/stay';
import { minimumNights } from '../services/minimumStay';
import { parseRecurringPeriods, matchRecurringStays, completionForPeriod, recurringScore } from '../services/recurringSearch';
import { distanceKm, validCoordinates } from '../services/proximity';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPeriods = useMemo(() => parseRecurringPeriods(searchParams), [searchParams]);
  const isRecurring = requestedPeriods.length > 1;
  const [recurringSearchOpen, setRecurringSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [sortChoice, setSortChoice] = useState<'best' | 'coverage'>('best');
  const flexibleDates = searchParams.get('flex') === '1';
  const cityParam = searchParams.get('city') || '';
  const cityCode = searchParams.get('cityCode') || '';
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [searchCity, setSearchCity] = useState(cityParam);
  const [searchCityCode, setSearchCityCode] = useState(cityCode);
  const [searchStart, setSearchStart] = useState(searchParams.get('start') || '');
  const [editedPeriods, setEditedPeriods] = useState(requestedPeriods);
  const [searchEnd, setSearchEnd] = useState(searchParams.get('end') || '');
  useEffect(() => {
    setEditedPeriods(requestedPeriods);
    setSearchCity(cityParam); setSearchCityCode(cityCode);
    setSearchStart(searchParams.get('start') || ''); setSearchEnd(searchParams.get('end') || '');
  }, [searchParams, cityParam, cityCode, requestedPeriods]);
  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries({ city: searchCity, cityCode: searchCityCode, start: searchStart, end: searchEnd })) {
      if (value) next.set(key, value); else next.delete(key);
    }
    if (isRecurring) {
      const validated = parseRecurringPeriods(new URLSearchParams({ periods: JSON.stringify(editedPeriods) }));
      if (validated.length !== editedPeriods.length) { setSearchError('Renseigne des séjours valides, sans chevauchement.'); return; }
      next.set('periods', JSON.stringify(validated));
      next.set('start', validated[0].start); next.set('end', validated[0].end);
    }
    setSearchError(''); setSearchParams(next); setMobileFiltersOpen(false); setRecurringSearchOpen(false); setMobileSearchOpen(false);
  };

  const { start: startDate, end: endDate } = readSearchDates(searchParams);
  const [searchError, setSearchError] = useState('');
  const [geocodingError, setGeocodingError] = useState(false);
  
  // Consommation du contexte global
  const { listings: allListings, isLoading: listingsLoading, error: listingsError } = useListings();
  const [availabilityError, setAvailabilityError] = useState('');
  const [availability, setAvailability] = useState<BookingAvailability[]>([]);
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(Boolean(startDate || endDate));

  useEffect(() => {
    if (!startDate && !endDate) {
      setIsAvailabilityLoading(false);
      return;
    }
    setIsAvailabilityLoading(true); setAvailabilityError('');
    return apiService.availability.listenAll(items => {
      setAvailability(items); setAvailabilityError('');
      setIsAvailabilityLoading(false);
    }, error => { setAvailabilityError(error.message); setIsAvailabilityLoading(false); });
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

  const recurrenceMatches = useMemo(() => new Map(allListings.map(listing => [listing.id, matchRecurringStays(listing, availability, requestedPeriods, flexibleDates, selectedRoomOptions)])), [allListings, availability, requestedPeriods, flexibleDates, selectedRoomOptions]);
  const stayNights = countNights(startDate, endDate) || 1;
  const listingStayPrice = (listing: Listing) => {
    if (isRecurring) return recurrenceMatches.get(listing.id)?.average || 0;
    const roomPrice = Math.min(...listing.rooms.map(room => room.pricePerDay)) * stayNights;
    return roomPrice + (Number(listing.cleaningFee) || 0) + Math.round(roomPrice * 0.15);
  };

  const priceCeiling = useMemo(() => {
    const highest = isRecurring ? Math.max(0, ...Array.from(recurrenceMatches.values()).map(match => match.average)) : Math.max(0, ...allListings.flatMap(listing => listing.rooms.map(room => { const base = room.pricePerDay * stayNights; return base + (listing.cleaningFee || 0) + Math.round(base * 0.15); })));
    return Math.max(100, Math.ceil(highest / 100) * 100);
  }, [allListings, stayNights, isRecurring, recurrenceMatches]);

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
  }, [allListings, stayNights, priceCeiling, isRecurring, recurrenceMatches]);

  const previousPriceCeiling = useRef(priceCeiling);
  useEffect(() => {
    const previous = previousPriceCeiling.current;
    previousPriceCeiling.current = priceCeiling;
    setPriceMax(current => current >= previous ? priceCeiling : Math.min(current, priceCeiling));
    setPriceMin(current => Math.min(current, priceCeiling));
  }, [priceCeiling]);

  const previousMaxRoomCount = useRef(maxRoomCount);
  useEffect(() => {
    const previous = previousMaxRoomCount.current;
    previousMaxRoomCount.current = maxRoomCount;
    setMaxRooms(current => current >= previous ? maxRoomCount : Math.min(current, maxRoomCount));
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
  const { exactMatches, nearbyDateMatches, nearbyMatches, completionCandidates } = useMemo(() => {
    // 0. Security Filter: ONLY APPROVED LISTINGS
    const approvedListings = allListings.filter(l => l.status === 'APPROVED');

    // 1. Filters independent from the requested dates. They are also used for
    // the “nearby dates” section below.
    const listingsMatchingFilters = approvedListings.filter(listing => {
      // Handle case where rooms might be empty
      if (!listing.rooms || listing.rooms.length === 0) return false;
      if (!isRecurring && startDate && endDate && countNights(startDate, endDate) < minimumNights(listing.minStay)) return false;
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
    const matchesStayPrice = (listing: Listing, start = startDate, end = endDate) => {
      const price = isRecurring ? recurrenceMatches.get(listing.id)?.average ?? 0 : cheapestStayPrice(listing, availability, start, end)?.total ?? listingStayPrice(listing);
      return price >= priceMin && price <= priceMax;
    };
    const isAvailableForRequestedStay = (listing: Listing) => isRecurring
      ? Boolean(recurrenceMatches.get(listing.id)?.availableCount)
      : listingHasAvailableRoom(listing, availability, startDate, endDate);

    // 2. Exact city and exact requested stay.
    const exactCityListings = listingsMatchingFilters.filter(isInRequestedCity);
    const exactMatches = exactCityListings.filter(listing => isAvailableForRequestedStay(listing) && matchesStayPrice(listing));

    // 3. Same city, same duration, at the closest available dates. This section
    // comes after exact results and never replaces them.
    const nearbyDateMatches: ListingWithNearbyStay[] = !isRecurring && startDate && endDate
      ? exactCityListings
        .filter(listing => !isAvailableForRequestedStay(listing))
        .flatMap(listing => {
          const nearbyStay = findClosestAvailableStay(listing, availability, startDate, endDate);
          return nearbyStay && matchesStayPrice(listing, nearbyStay.startDate, nearbyStay.endDate) ? [{ ...listing, nearbyStay }] : [];
        })
        .sort((a, b) => Math.abs(a.nearbyStay.offsetDays) - Math.abs(b.nearbyStay.offsetDays))
      : [];

    // 4. Proximity search keeps the exact dates and excludes the city already
    // shown in the first two sections.
    let nearbyMatches: ListingWithDistance[] = [];
    if (cityParam && dynamicCityCoords) {
      nearbyMatches = sortByDistance(
        listingsMatchingFilters.filter(listing => isAvailableForRequestedStay(listing) && matchesStayPrice(listing) && !isInRequestedCity(listing)),
        dynamicCityCoords
      );
      // Distance limit removed as requested
    }

    if (isRecurring) {
      const rank = (a: ListingWithDistance, b: ListingWithDistance) => {
        const am = recurrenceMatches.get(a.id)!, bm = recurrenceMatches.get(b.id)!;
        if (sortChoice === 'coverage' && am.availableCount !== bm.availableCount) return bm.availableCount - am.availableCount;
        const distance = (listing: ListingWithDistance) => dynamicCityCoords && validCoordinates(listing.coordinates) ? distanceKm(dynamicCityCoords, listing.coordinates) : undefined;
        return recurringScore(b, bm, distance(b)) - recurringScore(a, am, distance(a)) || a.id.localeCompare(b.id);
      };
      exactMatches.sort(rank); nearbyMatches.sort(rank);
    }
    return {
      completionCandidates: listingsMatchingFilters,
      exactMatches, 
      nearbyMatches,
      nearbyDateMatches,
    };
  }, [allListings, availability, cityParam, startDate, endDate, priceMin, priceMax, selectedTypes, minRooms, maxRooms, selectedAmenities, selectedRoomOptions, dynamicCityCoords, isRecurring, recurrenceMatches, sortChoice]);

  const recurrenceCardProps = (listing: Listing) => {
    if (!isRecurring) return {};
    const recurrence = recurrenceMatches.get(listing.id)!;
    return { recurrence, requestedPeriods, flexibleDates, completions: recurrence.periods.filter(period => !period.stay).map(period => {
      const candidates = completionCandidates.filter(candidate => {
        const match = matchRecurringStays(candidate, availability, [period.requested], false, selectedRoomOptions);
        return match.availableCount > 0 && match.average >= priceMin && match.average <= priceMax;
      });
      return completionForPeriod(listing, candidates, availability, period.requested, selectedRoomOptions);
    }) };
  };

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

  const isSearching = isGeocoding || listingsLoading || isAvailabilityLoading;

  if (searchParams.has('periods') && !isRecurring) return <div className="mx-auto max-w-xl p-10 text-center" role="alert">Les dates des séjours sont invalides ou se chevauchent. <a href="/#/" className="underline">Reprendre la recherche</a></div>;

  if ((startDate || endDate || isRecurring) && availabilityError) return <div className="mx-auto max-w-xl p-12 text-center text-haven-navy" role={availabilityError ? 'alert' : 'status'}>{availabilityError || 'Vérification des chambres disponibles…'}{availabilityError && <p className="mt-3 text-sm text-gray-500">Réessayez dans un instant. La réservation reste bloquée tant que les disponibilités ne peuvent pas être vérifiées.</p>}</div>;

  const activeFilterCount = selectedTypes.length + selectedAmenities.length + selectedRoomOptions.length
    + Number(priceMin > 0 || priceMax < priceCeiling) + Number(minRooms > 1 || maxRooms < maxRoomCount);

  return (
    <div className="min-h-screen bg-haven-cream pt-3 md:pt-8 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4 md:hidden">
          <h1 className="sr-only">Résultats de recherche{cityParam ? ` à ${cityParam.split(',')[0]}` : ''}</h1>
          <div className="flex items-center gap-2">
            <Link to="/" aria-label="Retour à l’accueil" className="flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-haven-navy"><ArrowLeft size={20} /></Link>
            <button type="button" aria-expanded={mobileSearchOpen} aria-controls="recurring-search-editor" onClick={() => { setMobileSearchOpen(open => !open); setMobileFiltersOpen(false); }} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 text-left shadow-sm">
              <Search size={17} className="shrink-0 text-haven-red" aria-hidden="true" />
              <span className="min-w-0"><span className="block truncate text-sm font-bold">{cityParam.split(',')[0] || 'Tous les logements'}</span><span className="block truncate text-xs text-gray-500">{isRecurring ? `${requestedPeriods.length} séjours · ${requestedPeriods.reduce((sum, period) => sum + countNights(period.start, period.end), 0)} nuits` : startDate && endDate ? `${new Date(`${startDate}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })} → ${new Date(`${endDate}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : 'Choisir mes dates'}</span></span>
              <span className="sr-only"> · Modifier ma recherche</span>
            </button>
            <button type="button" aria-label={mobileFiltersOpen ? 'Fermer les filtres' : 'Filtrer les résultats'} aria-expanded={mobileFiltersOpen} aria-controls="search-filters" onClick={() => { setMobileFiltersOpen(open => !open); setMobileSearchOpen(false); }} className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${mobileFiltersOpen ? 'border-haven-navy bg-haven-navy text-white' : 'border-gray-200 bg-white text-haven-navy'}`}><SlidersHorizontal size={19} />{activeFilterCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-haven-red px-1 text-[9px] font-bold text-white">{activeFilterCount}<span className="sr-only"> filtre(s) actif(s)</span></span>}</button>
          </div>
        </div>
        {/* Top Header */}
        <div className="mb-8 hidden md:block">
          <div className="flex items-center gap-4">
            <h1 className="font-heading font-bold text-3xl text-haven-navy">
              {isRecurring ? `${requestedPeriods.length} séjours demandés · ${cityParam.split(',')[0]}` : exactMatches.length > 0 ? `Logements à ${cityParam.split(',')[0]}` : 'Chercher mon logement'}
            </h1>
            {isGeocoding && <Loader2 className="animate-spin text-haven-stone" size={24} />}
          </div>
        </div>

        {isRecurring && <div className="mb-5 hidden flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 md:flex">
          <div className="flex min-w-0 items-center gap-3">
            <MapPin size={18} className="shrink-0 text-haven-red" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-haven-navy">{cityParam || 'Tous les logements'}</p>
              <p className="text-xs text-gray-500">{requestedPeriods.length} séjours · {requestedPeriods.reduce((sum, period) => sum + countNights(period.start, period.end), 0)} nuits au total</p>
            </div>
          </div>
          <button type="button" aria-expanded={recurringSearchOpen} aria-controls="recurring-search-editor"
            onClick={() => setRecurringSearchOpen(open => !open)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-haven-navy hover:bg-gray-50">
            <SlidersHorizontal size={15} aria-hidden="true" />{recurringSearchOpen ? 'Masquer les dates' : 'Modifier ma recherche'}
          </button>
        </div>}

        {(!isRecurring || recurringSearchOpen || mobileSearchOpen) && <form id="recurring-search-editor" onSubmit={submitSearch} className={`relative z-20 mb-4 gap-3 rounded-3xl border border-gray-200 bg-white p-4 md:mb-6 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] ${mobileSearchOpen ? 'grid' : 'hidden md:grid'}`}>
          <div className="flex items-center justify-between sm:col-span-2 lg:hidden md:hidden"><h2 className="text-sm font-bold">Modifier ma recherche</h2><button type="button" aria-label="Fermer la modification de recherche" onClick={() => setMobileSearchOpen(false)} className="flex h-11 w-11 items-center justify-center"><X size={18} /></button></div>
          <label className="min-w-0"><span className="mb-2 block text-xs font-bold text-gray-500">Ville</span><div className="min-h-11"><CityAutocomplete value={searchCity} onChange={value => { setSearchCity(value); setSearchCityCode(''); }} onSelect={place => setSearchCityCode(place.cityCode || '')} placeholder="Où cherchez-vous ?" /></div></label>
          <div className="min-w-0 space-y-3">{isRecurring ? editedPeriods.map((period, index) => <div key={index}>
            <p className="mb-2 text-xs font-bold text-gray-500">Dates du séjour {index + 1}</p>
            <DateRangePicker startDate={period.start} endDate={period.end}
              otherStays={editedPeriods.flatMap((other, otherIndex) => otherIndex === index ? [] : [{ ...other, label: `Séjour ${otherIndex + 1}` }])}
              onChange={(start, end) => setEditedPeriods(previous => previous.map((item, itemIndex) => itemIndex === index ? { start, end } : item))} />
          </div>) : <><p className="mb-2 text-xs font-bold text-gray-500">Dates du séjour</p><div className="min-h-11"><DateRangePicker startDate={searchStart} endDate={searchEnd} onChange={(start, end) => { setSearchStart(start); setSearchEnd(end); }} /></div></>}</div>
          <Button type="submit" className="self-end sm:col-span-2 lg:col-span-1">Rechercher</Button>
        </form>}

        {searchError && <p role="alert" className="mb-4 text-sm text-haven-red">{searchError}</p>}
        {isRecurring && <div className="mb-4 flex flex-wrap items-center gap-2 md:mb-6 md:gap-3" role="group" aria-label="Classement des séjours récurrents">
          <button type="button" aria-pressed={sortChoice === 'best'} onClick={() => setSortChoice('best')} className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-bold ${sortChoice === 'best' ? 'border-haven-navy bg-haven-navy text-white' : 'border-gray-200 bg-white text-haven-navy'}`}>Meilleur choix</button>
          <button type="button" aria-pressed={sortChoice === 'coverage'} onClick={() => setSortChoice('coverage')} className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-bold ${sortChoice === 'coverage' ? 'border-haven-navy bg-haven-navy text-white' : 'border-gray-200 bg-white text-haven-navy'}`}>Plus de séjours</button>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={flexibleDates} onChange={event => { const next = new URLSearchParams(searchParams); if (event.target.checked) next.set('flex', '1'); else next.delete('flex'); setSearchParams(next); }} className="h-4 w-4 accent-haven-red" />Dates ±1 jour</label>
          <p className="hidden w-full text-xs text-gray-500 md:block">{sortChoice === 'best' ? 'Un équilibre entre proximité, séjours disponibles et notes.' : 'Les logements couvrant le plus de séjours en premier.'} Les dates décalées sont toujours signalées.</p>
        </div>}

        {/* Banner: Exact dates are unavailable in the requested city */}
        {!isSearching && exactMatches.length === 0 && cityParam && (nearbyDateMatches.length > 0 || nearbyMatches.length > 0) && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-3 md:mb-8 md:items-center md:gap-6 md:rounded-3xl md:p-6 animate-fade-in-up">
            <div className="shrink-0 rounded-xl bg-orange-100 p-2 text-orange-600 md:rounded-2xl md:p-4">
              <MapPin className="h-5 w-5 md:h-8 md:w-8" />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-snug text-orange-900 md:text-lg">Aucun logement libre à {cityParam.split(',')[0]} pour ces dates</h3>
              <p className="mt-1 text-xs leading-relaxed text-orange-800/70 md:hidden">{nearbyDateMatches.length > 0 ? 'D’autres dates et logements à proximité sont proposés ci-dessous.' : 'Découvre les logements à proximité ci-dessous.'}</p>
              <p className="hidden text-orange-800/70 text-sm mt-1 max-w-2xl md:block">
                Découvrez d’abord les disponibilités à des dates proches dans cette ville, puis les logements des villes voisines aux dates demandées.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 md:gap-8">
          {/* Sidebar Filters */}
          <aside className={`w-full min-w-0 lg:w-1/4 h-fit bg-white p-4 lg:p-6 rounded-3xl shadow-premium border border-gray-100 lg:sticky lg:top-24 ${mobileFiltersOpen ? 'block' : 'hidden'} md:block`}>
            <div className="mb-2 flex items-center justify-between gap-3 text-haven-navy">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={20} />
                <h2 className="hidden font-bold text-lg lg:block">Ajuster ma recherche</h2>
                <button type="button" aria-expanded={mobileFiltersOpen} aria-controls="search-filters" onClick={() => setMobileFiltersOpen(value => !value)} className="min-h-11 text-left font-bold lg:hidden">{mobileFiltersOpen ? 'Fermer les filtres' : 'Filtrer les résultats'}</button>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs font-bold text-haven-red transition-opacity hover:opacity-70"
              >
                <RotateCcw size={14} /> Réinitialiser
              </button>
            </div>

            <div id="search-filters" className={`${mobileFiltersOpen ? 'block' : 'hidden'} lg:block`}>
            <FilterSection title={isRecurring ? "Prix moyen par séjour disponible" : "Prix du séjour"} isOpen={openFilter === 'PRICE'} onToggle={() => setOpenFilter(openFilter === 'PRICE' ? null : 'PRICE')}>
              <p className="text-sm text-gray-500">{isRecurring ? "Moyenne des séjours disponibles, frais compris" : <>{stayNights} nuit{stayNights > 1 ? 's' : ''}, tous frais compris</>}</p>
              <div className="mt-5 flex h-20 items-end gap-0.5 px-1" aria-hidden="true">
                {histogram.map((height, index) => (
                  <span key={index} className="flex-1 rounded-t-sm bg-haven-red" style={{ height: `${height}%` }} />
                ))}
              </div>
              <div className="haven-dual-range mt-4">
                <div className="haven-dual-range-track" />
                <div
                  className="haven-dual-range-selection"
                  style={{
                    left: `${(priceMin / priceCeiling) * 100}%`,
                    width: `${((priceMax - priceMin) / priceCeiling) * 100}%`,
                  }}
                />
                <label className="sr-only" htmlFor="price-min">Prix minimum du séjour</label>
                <input
                  id="price-min"
                  type="range"
                  min="0"
                  max={priceCeiling}
                  step="10"
                  value={priceMin}
                  onChange={(event) => setPriceMin(Math.min(Number(event.target.value), priceMax))}
                  className="haven-dual-range-input haven-dual-range-min"
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
                  className="haven-dual-range-input haven-dual-range-max"
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
            <Button type="button" fullWidth onClick={() => setMobileFiltersOpen(false)} className="lg:hidden">Afficher les résultats</Button>
            </div>
          </aside>

          {/* Results Grid */}
          <div className="w-full min-w-0 lg:w-3/4 space-y-8 lg:space-y-12">
            {!isSearching && exactMatches.length > 0 && (
              <div className="space-y-0 md:space-y-6">
                <div className="hidden items-center gap-3 md:flex">
                  <div className="h-px flex-1 bg-gray-100"></div>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Logements à {cityParam.split(',')[0]}</h2>
                  <div className="h-px flex-1 bg-gray-100"></div>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  {exactMatches.map(listing => (
                    <ListingCard key={listing.id} listing={listing} availability={availability} {...recurrenceCardProps(listing)} />
                  ))}
                </div>
              </div>
            )}

            {!isSearching && nearbyDateMatches.length > 0 && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5">
                  <h2 className="font-heading font-bold text-lg text-haven-navy">Disponibles à des dates proches</h2>
                  <p className="mt-1 text-sm text-gray-600">Même durée de séjour, dans la ville recherchée. Sélectionnez une proposition pour utiliser ses dates.</p>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  {nearbyDateMatches.map(listing => {
                    const { nearbyStay } = listing;
                    const label = `Du ${new Date(`${nearbyStay.startDate}T12:00:00`).toLocaleDateString('fr-FR')} au ${new Date(`${nearbyStay.endDate}T12:00:00`).toLocaleDateString('fr-FR')}`;
                    return <ListingCard key={listing.id} listing={listing} availability={availability} stayOverride={{ start: nearbyStay.startDate, end: nearbyStay.endDate, label }} />;
                  })}
                </div>
              </div>
            )}

            {!isSearching && nearbyMatches.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-100"></div>
                  <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">À proximité</h2>
                  <div className="h-px flex-1 bg-gray-100"></div>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  {nearbyMatches.map(listing => (
                    <div key={listing.id} className="relative">
                      <ListingCard listing={listing} availability={availability} {...recurrenceCardProps(listing)} />
                      <div className="pointer-events-none absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm text-haven-navy px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 border border-gray-100">
                        <Route size={14} className="text-haven-red" />
                        À {Math.round(listing.distance || 0)} km à vol d’oiseau
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isSearching && <SearchLoading message={isAvailabilityLoading ? 'Vérification des chambres disponibles…' : 'Recherche des logements disponibles…'} />}
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
