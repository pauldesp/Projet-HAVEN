import React, { useId, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Plus, Repeat2, Search, X } from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import './HomeSearchPreview.css';
import { CityAutocomplete } from './CityAutocomplete';
import { Link, useNavigate } from 'react-router-dom';

type Mode = 'single' | 'recurring';
type Period = { id: number; start: string; end: string };
const frenchNumberStem = (number: number): string => {
  const units = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
  if (number < 17) return units[number];
  if (number < 20) return `dix-${units[number - 10]}`;
  if (number < 100) {
    const base = number >= 80 ? 80 : number >= 60 ? 60 : Math.floor(number / 10) * 10;
    const tens: Record<number, string> = { 20: 'vingt', 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante', 80: 'quatre-vingt' };
    const remainder = number - base;
    return tens[base] + (remainder ? `${base !== 80 && (remainder === 1 || remainder === 11) ? '-et-' : '-'}${frenchNumberStem(remainder)}` : '');
  }
  const scale = number < 1000 ? 100 : number < 1000000 ? 1000 : number < 1000000000 ? 1000000 : 1000000000;
  const names: Record<number, string> = { 100: 'cent', 1000: 'mille', 1000000: 'million', 1000000000: 'milliard' };
  const count = Math.floor(number / scale);
  const prefix = count === 1 && scale <= 1000 ? '' : `${frenchNumberStem(count)}-`;
  return `${prefix}${names[scale]}${number % scale ? `-${frenchNumberStem(number % scale)}` : ''}`;
};
const periodLabel = (index: number) => {
  const stem = frenchNumberStem(index + 1);
  const ordinal = index === 0 ? 'premier' : index === 1 ? 'second' : `${stem.replace(/cinq$/, 'cinqu').replace(/neuf$/, 'neuv').replace(/e$/, '')}ième`;
  return `Dates du ${ordinal} séjour`;
};
const nightsBetween = (start: string, end: string) => start && end ? Math.round((Date.parse(end) - Date.parse(start)) / 86400000) : 0;
export function HomeSearchPreview() {
  const id = useId();
  const navigate = useNavigate();
  const [cityCode, setCityCode] = useState('');
  const nextPeriodId = useRef(3);
  const [mode, setMode] = useState<Mode | null>(null);
  const [location, setLocation] = useState('');
  const [arrival, setArrival] = useState('');
  const [departure, setDeparture] = useState('');
  const [periods, setPeriods] = useState<Period[]>([
    { id: 1, start: '', end: '' }, { id: 2, start: '', end: '' },
  ]);
  const completePeriods = periods.filter(period => nightsBetween(period.start, period.end) > 0);
  const overlappingIds = new Set(completePeriods.filter(period => completePeriods.some(other =>
    other.id !== period.id && period.start < other.end && other.start < period.end
  )).map(period => period.id));
  const totalNights = completePeriods.reduce((sum, period) => sum + nightsBetween(period.start, period.end), 0);
  const singleNights = nightsBetween(arrival, departure);
  const ready = Boolean(mode && cityCode && location.trim() && (mode === 'single' ? singleNights > 0 : completePeriods.length === periods.length && overlappingIds.size === 0));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    const stays = mode === 'single' ? [{ start: arrival, end: departure }] : [...periods].sort((a, b) => a.start.localeCompare(b.start));
    const params = new URLSearchParams({ city: location, cityCode, start: stays[0].start, end: stays[0].end });
    if (mode === 'recurring') params.set('periods', JSON.stringify(stays.map(({ start, end }) => ({ start, end }))));
    navigate(`/search?${params}`);
  };

  return <div className="home-search-preview">
    <form className="home-search-card" onSubmit={submit} aria-label="Préparer ma recherche de logement">
      <div className="home-search-modes" role="group" aria-label="Type de réservation">
        {([
          { value: 'single' as const, title: 'Réservation unique', description: 'Quelques nuits, une semaine ou plus', Icon: CalendarDays },
          { value: 'recurring' as const, title: 'Récurrence', description: 'Réserve tous tes séjours à l’avance et paie au moment de chaque séjour.', Icon: Repeat2 },
        ]).map(({ value, title, description, Icon }) => <div key={value} className={`home-search-mode ${mode === value ? 'is-active' : ''}`}>
          <button type="button" aria-pressed={mode === value} className="home-search-mode-select"
          onClick={() => { setMode(value); }}>
          <span className="home-search-mode-title"><Icon size={21} aria-hidden="true" /><span>{title}</span><span className="home-search-choice" aria-hidden="true">{mode === value && <Check size={12} />}</span></span>
          <span className="home-search-mode-description">{description}</span>
          </button>
        </div>)}
      </div>
      <div className="home-search-info-row"><Link to="/reservation-recurrente" className="home-search-info-link">+ d’infos sur la réservation récurrente</Link></div>

      <label className="home-search-label" htmlFor={`${id}-location`}>Lieu de la recherche</label>
      <div className="home-search-location">
        <CityAutocomplete inputId={`${id}-location`} ariaLabel="Lieu de la recherche" value={location}
          placeholder="Rechercher une ville, un quartier ou une adresse"
          onChange={value => { setLocation(value); setCityCode(''); }}
          onSelect={place => setCityCode(place.cityCode || '')} />
      </div>

      {mode && <>
      {mode === 'single' ? <>
        <div className="home-search-single-dates">
          <p className="home-search-label">Dates du séjour</p>
          <div className="home-search-date-picker">
            <DateRangePicker startDate={arrival} endDate={departure}
              onChange={(start, end) => { setArrival(start); setDeparture(end); }} />
          </div>
        </div>
        <p className="home-search-detail">{singleNights > 0 ? <><strong>{singleNights} nuit{singleNights > 1 ? 's' : ''}</strong> · </> : null}Selon les dates choisies, le propriétaire pourra devoir confirmer manuellement ta réservation.</p>
      </> : <>
        <div className="home-search-periods">
          {periods.map((period, index) => <section key={period.id} aria-label={periodLabel(index)} className="home-search-period">
            <div className="home-search-period-heading">
              <h2 className="home-search-label">{periodLabel(index)}</h2>
              {periods.length > 2 && <button type="button" className="home-search-remove-period" aria-label={`Supprimer le séjour ${index + 1}`}
                onClick={() => { setPeriods(previous => previous.filter(item => item.id !== period.id)); }}><X size={16} aria-hidden="true" /></button>}
            </div>
            <div className="home-search-date-picker">
              <DateRangePicker startDate={period.start} endDate={period.end}
                otherStays={periods.flatMap((item, itemIndex) => item.id === period.id ? [] : [{ start: item.start, end: item.end, label: `Séjour ${itemIndex + 1}` }])}
                onChange={(start, end) => { setPeriods(previous => previous.map(item => item.id === period.id ? { ...item, start, end } : item)); }} />
            </div>
            {overlappingIds.has(period.id) && <p className="home-search-period-error" role="alert">Ces dates chevauchent un autre séjour. Choisis une autre période.</p>}
          </section>)}
          <button type="button" className="home-search-add-period" onClick={() => {
            const periodId = nextPeriodId.current++;
            setPeriods(previous => [...previous, { id: periodId, start: '', end: '' }]);
          }}><Plus size={18} aria-hidden="true" />Ajouter un nouveau séjour</button>
        </div>
        <p className="home-search-detail" aria-live="polite">{completePeriods.length ? <><strong>{completePeriods.length} séjour{completePeriods.length > 1 ? 's' : ''} renseigné{completePeriods.length > 1 ? 's' : ''} · {totalNights} nuits</strong> · </> : null}Renseigne les dates de chaque séjour avant de rechercher. Tu peux en ajouter autant que nécessaire.</p>
      </>}

      <button type="submit" className="home-search-submit" disabled={!ready}><Search size={18} aria-hidden="true" />Rechercher<ArrowRight size={18} aria-hidden="true" /></button>

      </>}
    </form>
  </div>;
}
