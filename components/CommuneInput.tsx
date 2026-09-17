import React, { useEffect, useId, useState } from 'react';
import { City, cityLabel, findCities, loadCities } from '../services/cities';

export function CommuneInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const id = useId();
  const [cities, setCities] = useState<City[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [options, setOptions] = useState<City[]>([]);
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!open || cities.length) return;
    let cancelled = false;
    setBusy(true); setFailed(false);
    loadCities().then(data => { if (!cancelled) setCities(data); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [open, cities.length]);
  useEffect(() => {
    setOptions([]); setActive(-1); setSearching(true);
    const timer = setTimeout(() => { setOptions(findCities(cities, value)); setSearching(false); }, 180);
    return () => clearTimeout(timer);
  }, [cities, value]);
  const select = (city: City) => { onChange(cityLabel(city)); setOpen(false); };
  return <div className="relative w-full h-full" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <input role="combobox" aria-label={placeholder || 'Ville'} aria-expanded={open} aria-controls={id} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined}
      value={value} placeholder={placeholder} autoComplete="off" className="w-full h-full bg-transparent outline-none text-base font-bold"
      onFocus={() => setOpen(true)} onChange={event => { onChange(event.target.value); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { setOpen(false); return; }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(index => options.length ? index < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length : -1); }
        if (event.key === 'Enter' && open && active >= 0 && options[active]) { event.preventDefault(); select(options[active]); }
      }} />
    {open && value.trim().length >= 2 && <div className="absolute top-full left-0 z-50 mt-2 w-full min-w-[220px] rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
      <ul id={id} role="listbox" aria-label="Communes suggérées">
        {options.map((city, index) => <li key={city.code} id={`${id}-${index}`} role="option" aria-selected={active === index}>
          <button type="button" onMouseDown={event => event.preventDefault()} onClick={() => select(city)} className={`w-full px-4 py-3 text-left text-sm ${active === index ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
            <span className="block font-bold text-haven-navy">{city.nom}</span><span className="text-gray-500">{city.codesPostaux.join(', ')}</span>
          </button>
        </li>)}
      </ul>
      {!options.length && <p role="status" className="p-4 text-sm text-gray-500">{busy || searching ? 'Recherche des communes…' : failed ? 'Suggestions indisponibles. Vérifiez votre connexion ou saisissez le nom complet.' : 'Aucune suggestion. Essayez le code postal ou vérifiez le nom.'}</p>}
    </div>}
  </div>;
}
