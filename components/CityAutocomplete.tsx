
import React, { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

export interface PlaceData {
  fullAddress: string;
  address: string;
  city: string;
  zipCode: string;
  country: string;
}

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (place: PlaceData) => void;
  placeholder?: string;
  isAddressMode?: boolean;
}

export const CityAutocomplete: React.FC<CityAutocompleteProps> = ({ 
  value, 
  onChange, 
  onSelect, 
  placeholder, 
  isAddressMode = false 
}) => {
  const placesLib = useMapsLibrary('places');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);

  const autocompleteRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onChangeRef.current = onChange;
  }, [onSelect, onChange]);

  // Sync internal value with prop value
  useEffect(() => {
    if (autocompleteRef.current && value !== undefined && autocompleteRef.current.value !== value) {
      autocompleteRef.current.value = value;
    }
  }, [value]);

  useEffect(() => {
    if (!placesLib || !containerRef.current) return;

    // Create the web component
    let autocompleteElement: any;
    if (placesLib.PlaceAutocompleteElement) {
      autocompleteElement = new placesLib.PlaceAutocompleteElement();
    } else {
      autocompleteElement = document.createElement('place-autocomplete-element');
    }
    
    autocompleteRef.current = autocompleteElement;

    // Configure it
    if (placeholder) {
      autocompleteElement.setAttribute('placeholder', placeholder);
    }

    // Set initial value
    if (value) {
      autocompleteElement.value = value;
    }

    if (!isAddressMode) {
      try {
        autocompleteElement.setAttribute('types', 'locality');
      } catch (e) {
        console.warn("Could not set 'types' attribute on PlaceAutocompleteElement", e);
      }
    }

    // Style the web component
    containerRef.current.innerHTML = '';
    
    const styles = {
      '--background-color': '#ffffff',
      '--text-color': '#141414',
      '--placeholder-color': '#D1D5DB',
      '--font-family': 'inherit',
      '--font-size': '1.125rem',
      '--font-weight': '700',
      '--border-radius': '0',
      '--border-width': '0',
      '--padding': '0',
      'background-color': '#ffffff',
      'color': '#141414',
      'width': '100%',
      'border': 'none',
      'outline': 'none',
      'color-scheme': 'light'
    };
    
    Object.entries(styles).forEach(([key, value]) => {
      autocompleteElement.style.setProperty(key, value, 'important');
    });

    autocompleteElement.setAttribute('style', 'background-color: #ffffff !important; color: #141414 !important; width: 100% !important; border: none !important; outline: none !important; color-scheme: light !important;');
    
    containerRef.current.appendChild(autocompleteElement);

    const handleSelect = async (event: any) => {
      // The new API uses event.place, but some versions might use event.placePrediction
      // or put it in event.detail
      let place = event.place || (event.detail && event.detail.place);
      
      if (!place && (event.placePrediction || (event.detail && event.detail.placePrediction))) {
        const prediction = event.placePrediction || event.detail.placePrediction;
        if (prediction && typeof prediction.toPlace === 'function') {
          place = prediction.toPlace();
        }
      }
      
      // Fallback for older versions or different event structures
      if (!place && event.target && event.target.place) {
        place = event.target.place;
      }
      
      if (!place) return;

      isSelectingRef.current = true;
      
      // Ensure fetchFields is available and call it to get all details
      if (typeof place.fetchFields === 'function') {
        try {
          await place.fetchFields({ 
            fields: ['displayName', 'formattedAddress', 'addressComponents', 'location'] 
          });
        } catch (e) {
          console.error("Error fetching place fields:", e);
        }
      }

      const components = place.addressComponents || [];
      const getComponent = (types: string[]) => 
        components.find(c => types.some(t => c.types.includes(t)))?.longName || '';

      let city = getComponent(['locality', 'sublocality_level_1', 'postal_town', 'administrative_area_level_2']);
      let zipCode = getComponent(['postal_code']);
      let country = getComponent(['country']);
      const streetNumber = getComponent(['street_number']);
      const route = getComponent(['route']);
      
      // Get formatted address as a string
      const formattedAddress = typeof place.formattedAddress === 'string' 
        ? place.formattedAddress 
        : (place.displayName || '');
      
      // Fallback: If components are missing or incomplete, try to parse the formatted address
      if (!city || !zipCode) {
        const parts = formattedAddress.split(',').map(p => p.trim());
        
        // Pattern 1: "123 Street, 12345 City, Country"
        for (const part of parts) {
          const zipMatch = part.match(/(\d{5})/);
          if (zipMatch) {
            if (!zipCode) zipCode = zipMatch[1];
            if (!city) {
              const cityCandidate = part.replace(zipMatch[1], '').trim();
              if (cityCandidate) city = cityCandidate;
            }
          }
        }

        // Pattern 2: If city is still missing, look at the part before the country
        if (!city && parts.length >= 2) {
          const candidate = parts[parts.length - 2];
          const cityOnly = candidate.replace(/\d+/g, '').trim();
          if (cityOnly) city = cityOnly;
        }
      }

      // Build a clean street address (number + street)
      let cleanAddress = '';
      if (streetNumber && route) {
        cleanAddress = `${streetNumber} ${route}`;
      } else if (route) {
        cleanAddress = route;
      } else if (formattedAddress) {
        // Fallback: take the first part of formatted address if it looks like a street
        const firstPart = formattedAddress.split(',')[0].trim();
        // If it contains a number, it's likely the street address
        if (/\d/.test(firstPart)) {
          cleanAddress = firstPart;
        }
      }

      const placeData: PlaceData = {
        fullAddress: formattedAddress,
        address: cleanAddress || formattedAddress,
        city: city || '',
        zipCode: zipCode || '',
        country: country || 'France'
      };

      if (onSelectRef.current) {
        onSelectRef.current(placeData);
      } else if (onChangeRef.current) {
        onChangeRef.current(placeData.fullAddress);
      }

      // Reset the selecting flag after a short delay
      setTimeout(() => {
        isSelectingRef.current = false;
      }, 500);
    };

    const handleInput = (event: any) => {
      if (isSelectingRef.current) return;
      
      const newValue = event.target.value;
      if (onChangeRef.current && newValue !== undefined && newValue !== value) {
        onChangeRef.current(newValue);
      }
    };

    autocompleteElement.addEventListener('gmp-placeselect', handleSelect);
    autocompleteElement.addEventListener('gmp-select', handleSelect);
    autocompleteElement.addEventListener('change', handleSelect);
    autocompleteElement.addEventListener('input', handleInput);

    return () => {
      autocompleteElement.removeEventListener('gmp-placeselect', handleSelect);
      autocompleteElement.removeEventListener('gmp-select', handleSelect);
      autocompleteElement.removeEventListener('change', handleSelect);
      autocompleteElement.removeEventListener('input', handleInput);
      autocompleteRef.current = null;
    };
  }, [placesLib, isAddressMode, placeholder]);

  return (
    <div className="relative w-full group/city h-full">
      <div className="flex items-center gap-3 text-gray-600 h-full">
        <MapPin size={20} className="flex-shrink-0 text-haven-navy group-focus-within/city:text-haven-red transition-colors duration-300" />
        <div 
          ref={containerRef} 
          className="w-full gmp-autocomplete-container bg-white flex items-center h-full"
          style={{
            '--font-family': 'inherit',
            '--font-size': '1rem',
            '--font-weight': '700',
            '--text-color': '#141414',
            '--placeholder-color': '#9CA3AF',
            '--background-color': '#ffffff',
            '--border-radius': '0',
            '--border-width': '0',
            '--padding': '0',
          } as React.CSSProperties}
        />
      </div>

      <style>{`
        .gmp-autocomplete-container {
          width: 100%;
          background: #ffffff !important;
          color-scheme: light !important;
          height: 100% !important;
          display: flex !important;
          align-items: center !important;
        }
        place-autocomplete-element {
          width: 100% !important;
          background: #ffffff !important;
          background-color: #ffffff !important;
          color-scheme: light !important;
          display: flex !important;
          align-items: center !important;
          height: 100% !important;
        }
        /* Style the internal input of the web component */
        place-autocomplete-element::part(input) {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
          background: transparent !important;
          background-color: transparent !important;
          font-family: inherit !important;
          font-size: 1rem !important;
          font-weight: 700 !important;
          color: #141414 !important;
          width: 100% !important;
          color-scheme: light !important;
          height: 100% !important;
          line-height: normal !important;
          display: flex !important;
          align-items: center !important;
        }
        /* Target any internal input just in case ::part fails */
        place-autocomplete-element input {
          background: transparent !important;
          background-color: transparent !important;
          color: #141414 !important;
          padding: 0 !important;
          margin: 0 !important;
          height: 100% !important;
          display: flex !important;
          align-items: center !important;
        }
        /* Hide the default search icon provided by Google */
        place-autocomplete-element::part(icon) {
          display: none !important;
        }
        place-autocomplete-element::part(input)::placeholder {
          color: #9ca3af !important;
          font-weight: 400 !important;
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};
