import React, { useEffect, useId, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import type { PlaceData } from './CityAutocomplete';

type Commune = { code: string; nom: string; codesPostaux: string[]; departement?: { nom: string; code: string } };

export function FrenchCityAutocomplete({ value, onChange, onSelect, placeholder }: {
  value: string; onChange: (value: string) => void; onSelect?: (place: PlaceData) => void; placeholder?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Commune[]>([]);
  const [status, setStatus] = useState('');
  const [active, setActive] = useState(-1);

  useEffect(() => {
    input.current?.setCustomValidity(value && value !== selected ? 'Choisissez une ville dans les suggestions.' : '');
  }, [value, selected]);

  useEffect(() => {
    setResults([]);
    setActive(-1);
    if (!open || value === selected || value.trim().length < 2) {
      setStatus(value.trim().length < 2 ? 'Saisissez au moins 2 caractères.' : '');
      return;
    }
    const controller = new AbortController();
    setStatus('Recherche des villes…');
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ fields: 'nom,code,codesPostaux,departement', boost: 'population', limit: '8' });
        params.set(/^\d{5}$/.test(value.trim()) ? 'codePostal' : 'nom', value.trim());
        const response = await fetch(`https://geo.api.gouv.fr/communes?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Unavailable');
        const data: Commune[] = await response.json();
        if (controller.signal.aborted) return;
        setResults(data);
        setStatus(data.length ? '' : 'Aucune ville trouvée. Vérifiez le nom ou le code postal.');
      } catch {
        if (!controller.signal.aborted) setStatus('Suggestions indisponibles. Réessayez dans un instant.');
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, selected, open]);

  const choose = (city: Commune) => {
    setSelected(city.nom);
    setOpen(false);
    onChange(city.nom);
    onSelect?.({ cityCode: city.code, city: city.nom, fullAddress: `${city.nom}, France`, address: '', zipCode: city.codesPostaux[0] || '', country: 'France' });
  };

  return <div className="relative w-full h-full" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <div className="flex gap-3 items-center h-full">
      <MapPin size={20} className="shrink-0 text-haven-red" />
      <input ref={input} role="combobox" aria-label="Ville" aria-autocomplete="list" aria-expanded={open}
        aria-controls={`${id}-list`} aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
        autoComplete="off" value={value} placeholder={placeholder || 'Ville ou code postal'}
        className="w-full bg-transparent outline-none font-bold text-haven-navy placeholder:text-gray-400"
        onFocus={() => setOpen(true)}
        onChange={(event) => { setSelected(null); onChange(event.target.value); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            setActive((index) => results.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length : -1);
          }
          if (event.key === 'Enter' && open && active >= 0 && results[active]) { event.preventDefault(); choose(results[active]); }
        }} />
    </div>
    {open && value !== selected && <div className="absolute top-full left-0 mt-4 w-full min-w-[260px] z-50 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden">
      <ul id={`${id}-list`} role="listbox" aria-label="Villes proposées">
        {results.map((city, index) => <li key={city.code} id={`${id}-${index}`} role="option" aria-selected={index === active}
          className={`px-4 py-3 cursor-pointer text-left hover:bg-gray-50 ${index === active ? 'bg-gray-100' : ''}`}
          onMouseDown={(event) => event.preventDefault()} onClick={() => choose(city)}>
          <span className="block font-bold text-haven-navy">{city.nom}</span>
          <span className="block text-xs text-gray-500">{city.codesPostaux.join(', ')} · {city.departement?.nom || city.departement?.code}</span>
        </li>)}
      </ul>
      {status && <p role="status" className="px-4 py-3 text-sm text-gray-500">{status}</p>}
    </div>}
  </div>;
}
