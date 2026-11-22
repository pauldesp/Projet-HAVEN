import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Loader2, Minus, RefreshCw } from 'lucide-react';
import type { Listing } from '../types';
import { authenticatedFetch } from '../services/serverApi';
import { formatEuros } from '../services/money';
import { FUNNEL_LABELS, FUNNEL_STEPS, PAGE_LABELS, change, sumDays, topEntries, type AnalyticsDay } from '../services/analytics';

type Paid = { date: string; amount: number; commission: number; isTest: boolean };
type Payload = { from: string; to: string; previousFrom: string; previousTo: string; current: AnalyticsDay[]; previous: AnalyticsDay[]; paid: Paid[] };

// Single-series marks use Haven navy; the three device categories use a validated categorical trio.
const NAVY = '#0B245B';
const DEVICE_COLORS: Record<string, string> = { mobile: '#2a78d6', desktop: '#eb6834', tablet: '#1baf7a' };
const DEVICE_LABELS: Record<string, string> = { mobile: 'Téléphone', desktop: 'Ordinateur', tablet: 'Tablette' };
const SOURCE_LABELS: Record<string, string> = { direct: 'Accès direct', google: 'Google', bing: 'Bing', instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', x: 'X (Twitter)', tiktok: 'TikTok', whatsapp: 'WhatsApp' };
const PERIODS = [{ days: 7, label: '7 jours' }, { days: 30, label: '30 jours' }, { days: 90, label: '3 mois' }, { days: 365, label: '12 mois' }];

const number = (value: number) => value.toLocaleString('fr-FR');
const percent = (value: number) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
const dayLabel = (date: string, long = false) => new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', long ? { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' });
const datesBetween = (from: string, to: string) => {
  const list: string[] = [];
  for (let day = new Date(`${from}T12:00:00Z`); day.toISOString().slice(0, 10) <= to; day.setUTCDate(day.getUTCDate() + 1)) list.push(day.toISOString().slice(0, 10));
  return list;
};
/** Round axis maximum and 4 clean ticks. */
const niceScale = (max: number) => {
  if (max <= 4) return { top: 4, ticks: [0, 1, 2, 3, 4] };
  const rough = max / 4, power = 10 ** Math.floor(Math.log10(rough)), step = [1, 2, 2.5, 5, 10].map(n => n * power).find(n => n >= rough)!;
  return { top: step * 4, ticks: [0, step, step * 2, step * 3, step * 4] };
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function Card({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-3xl border border-gray-100 bg-white p-5 shadow-card sm:p-6 ${className}`}>
    <h3 className="font-bold text-haven-navy">{title}</h3>
    {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
    <div className="mt-4">{children}</div>
  </section>;
}

/** Hero number with its change against the previous period (arrow + words, never color alone). */
function Kpi({ label, value, current, previous, hint }: { label: string; value: string; current: number; previous: number; hint?: string }) {
  const delta = change(current, previous);
  const Icon = delta === null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = delta === null || delta === 0 ? 'bg-gray-100 text-gray-600' : delta > 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800';
  return <div className="min-w-0 rounded-3xl border border-gray-100 bg-white p-5 shadow-card">
    <p className="text-sm text-gray-500">{label}</p>
    <p className="mt-2 font-heading text-3xl font-bold tracking-tight text-haven-navy sm:text-4xl">{value}</p>
    <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${tone}`}><Icon size={13} aria-hidden="true" />{delta === null ? 'nouveau' : `${delta > 0 ? '+' : ''}${delta} %`}</span>
      {delta === null ? 'rien à comparer' : 'vs période précédente'}
    </p>
    {hint && <p className="mt-2 text-xs text-gray-400">{hint}</p>}
  </div>;
}

/** Visits per day: 2px line over a 10 % wash, crosshair and tooltip listing every figure of the day. */
function DailyChart({ dates, byDate, paidByDate }: { dates: string[]; byDate: Map<string, AnalyticsDay>; paidByDate: Map<string, number> }) {
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 240, left = 40, right = 12, top = 12, bottom = 28;
  const values = dates.map(date => byDate.get(date)?.sessions || 0);
  const { top: max, ticks } = niceScale(Math.max(...values, 1));
  const x = (index: number) => left + (dates.length < 2 ? 0 : index * (width - left - right) / (dates.length - 1));
  const y = (value: number) => top + (height - top - bottom) * (1 - value / max);
  const line = values.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const labelEvery = Math.ceil(dates.length / Math.max(2, Math.floor((width - left) / 70)));
  const pick = (clientX: number, element: SVGSVGElement) => {
    const rect = element.getBoundingClientRect();
    const ratio = (clientX - rect.left - left) / Math.max(1, rect.width - left - right);
    setHover(Math.max(0, Math.min(dates.length - 1, Math.round(ratio * (dates.length - 1)))));
  };
  const hovered = hover === null ? null : { date: dates[hover], day: byDate.get(dates[hover]), paid: paidByDate.get(dates[hover]) || 0 };
  return <div ref={box} className="relative">
    <svg width={width} height={height} role="img" aria-label="Visites par jour sur la période" className="block touch-pan-y"
      onPointerMove={event => pick(event.clientX, event.currentTarget)} onPointerLeave={() => setHover(null)}
      tabIndex={0} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); setHover(previous => Math.max(0, Math.min(dates.length - 1, (previous ?? dates.length - 1) + (event.key === 'ArrowRight' ? 1 : -1)))); } }}
      onBlur={() => setHover(null)}>
      {ticks.map(tick => <g key={tick}>
        <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="#EEF0F3" strokeWidth={1} />
        <text x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize="11" fill="#6B7280">{number(tick)}</text>
      </g>)}
      {dates.map((date, index) => index % labelEvery === 0 && <text key={date} x={x(index)} y={height - 8} textAnchor={index === 0 ? 'start' : 'middle'} fontSize="11" fill="#6B7280">{dayLabel(date)}</text>)}
      <path d={area} fill={NAVY} fillOpacity={0.1} />
      <path d={line} fill="none" stroke={NAVY} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {hover !== null && <g>
        <line x1={x(hover)} x2={x(hover)} y1={top} y2={y(0)} stroke="#9CA3AF" strokeWidth={1} />
        <circle cx={x(hover)} cy={y(values[hover])} r={5} fill={NAVY} stroke="#fff" strokeWidth={2} />
      </g>}
      {/* Last value labelled at the end of the line. */}
      {hover === null && values.length > 0 && <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={4} fill={NAVY} stroke="#fff" strokeWidth={2} />}
    </svg>
    {hovered && <div role="status" className="pointer-events-none absolute top-2 z-10 w-48 rounded-xl border border-gray-100 bg-white p-3 text-xs shadow-lg"
      style={{ left: Math.min(Math.max(0, x(hover!) + 12), width - 200) }}>
      <p className="mb-1.5 font-semibold text-haven-navy first-letter:uppercase">{dayLabel(hovered.date, true)}</p>
      {[['Visites', hovered.day?.sessions || 0], ['Pages vues', hovered.day?.pageviews || 0], ['Recherches', Object.values(hovered.day?.cities || {}).reduce((sum, count) => sum + count, 0)], ['Réservations payées', hovered.paid]].map(([label, value], index) => (
        <p key={label} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5 text-gray-500">{index === 0 && <span className="h-0.5 w-3 rounded-full" style={{ background: NAVY }} aria-hidden="true" />}{label}</span>
          <strong className="text-haven-navy">{number(Number(value))}</strong>
        </p>
      ))}
    </div>}
  </div>;
}

/** Horizontal bars with the value at the tip; the bar's title gives the share on hover. */
function BarList({ rows, total, empty }: { rows: { label: string; count: number }[]; total: number; empty: string }) {
  const max = Math.max(...rows.map(row => row.count), 1);
  if (!rows.length) return <p className="py-6 text-center text-sm text-gray-400">{empty}</p>;
  return <ul className="space-y-2.5">
    {rows.map(row => <li key={row.label} className="text-sm" title={`${row.label} : ${number(row.count)} (${total ? percent(row.count / total * 100) : '—'})`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-gray-700">{row.label}</span>
        <span className="shrink-0 font-semibold text-haven-navy">{number(row.count)}<span className="ml-1.5 text-xs font-normal text-gray-400">{total ? percent(row.count / total * 100) : ''}</span></span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full" style={{ width: `${Math.max(2, row.count / max * 100)}%`, background: NAVY }} /></div>
    </li>)}
  </ul>;
}

/** The booking path, step by step, with the share of visits kept and what is lost between two steps. */
function Funnel({ counts }: { counts: { label: string; count: number }[] }) {
  const base = Math.max(counts[0]?.count || 0, 1);
  return <ol className="space-y-3">
    {counts.map((step, index) => {
      const previous = index ? counts[index - 1].count : 0;
      const lost = index && previous ? Math.round((1 - step.count / previous) * 100) : null;
      return <li key={step.label}>
        {lost !== null && lost > 0 && <p className="mb-1 ml-1 text-xs text-gray-400">↓ {lost} % ne continuent pas</p>}
        {/* Label above the bar on phones, beside it from tablet width. */}
        <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-3">
          <span className="text-gray-700 sm:w-48 sm:shrink-0">{index + 1}. {step.label}</span>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative h-6 min-w-0 flex-1 rounded-r-[4px] bg-gray-50" title={`${step.label} : ${number(step.count)}`}>
              <div className="h-6 rounded-r-[4px]" style={{ width: `${Math.max(1, step.count / base * 100)}%`, background: NAVY }} />
            </div>
            <span className="w-24 shrink-0 text-right font-semibold text-haven-navy">{number(step.count)}<span className="ml-1 text-xs font-normal text-gray-400">{percent(step.count / base * 100)}</span></span>
          </div>
        </div>
      </li>;
    })}
  </ol>;
}

/** Visits by hour of the day (Paris time). */
function Hours({ hours }: { hours: Record<string, number> }) {
  const values = Array.from({ length: 24 }, (_, hour) => hours[String(hour)] || 0);
  const max = Math.max(...values, 1);
  const peak = values.indexOf(Math.max(...values));
  return <div>
    <div className="flex h-32 items-end gap-[2px]" role="img" aria-label={`Visites par heure ; pic à ${peak} h`}>
      {values.map((value, hour) => <div key={hour} className="group relative flex h-full flex-1 items-end" title={`${hour} h – ${hour + 1} h : ${number(value)} visite${value > 1 ? 's' : ''}`}>
        <div className="w-full rounded-t-[4px] transition-opacity group-hover:opacity-70" style={{ height: `${Math.max(value ? 4 : 0, value / max * 100)}%`, background: NAVY }} />
      </div>)}
    </div>
    <div className="mt-1 flex justify-between text-[11px] text-gray-400"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>23 h</span></div>
    {values.some(Boolean) && <p className="mt-2 text-xs text-gray-500">Heure la plus active : <strong className="text-haven-navy">{peak} h – {peak + 1} h</strong></p>}
  </div>;
}

/** Share of visits by device: one segmented bar (2px gaps), legend with values. */
function Devices({ devices }: { devices: Record<string, number> }) {
  const order = ['mobile', 'desktop', 'tablet'];
  const total = order.reduce((sum, key) => sum + (devices[key] || 0), 0);
  if (!total) return <p className="py-6 text-center text-sm text-gray-400">Pas encore de visite.</p>;
  return <div>
    <div className="flex h-4 gap-[2px] overflow-hidden rounded-[4px]">
      {order.filter(key => devices[key]).map(key => <div key={key} title={`${DEVICE_LABELS[key]} : ${percent(devices[key] / total * 100)}`} style={{ width: `${devices[key] / total * 100}%`, background: DEVICE_COLORS[key] }} />)}
    </div>
    <ul className="mt-4 space-y-2 text-sm">
      {order.map(key => <li key={key} className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-gray-700"><span className="h-3 w-3 rounded-[3px]" style={{ background: DEVICE_COLORS[key] }} aria-hidden="true" />{DEVICE_LABELS[key]}</span>
        <span className="font-semibold text-haven-navy">{percent((devices[key] || 0) / total * 100)}<span className="ml-1.5 text-xs font-normal text-gray-400">{number(devices[key] || 0)}</span></span>
      </li>)}
    </ul>
  </div>;
}

/** Haven's own audience measurement: anonymous, without cookies, exempt from consent. */
export function AdminAudience({ listings }: { listings: Listing[] }) {
  const [days, setDays] = useState(30);
  const [includeTests, setIncludeTests] = useState(true);
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await authenticatedFetch(`/api/admin/analytics?days=${days}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Audience indisponible.');
      setData(payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Audience indisponible.'); }
    finally { setLoading(false); }
  }, [days]);
  useEffect(() => { void load(); }, [load]);

  const view = useMemo(() => {
    if (!data) return null;
    const dates = datesBetween(data.from, data.to);
    const byDate = new Map(data.current.map(day => [day.date, day]));
    const paid = data.paid.filter(item => includeTests || !item.isTest);
    const inCurrent = paid.filter(item => item.date >= data.from && item.date <= data.to);
    const inPrevious = paid.filter(item => item.date >= data.previousFrom && item.date <= data.previousTo);
    const paidByDate = new Map<string, number>();
    for (const item of inCurrent) paidByDate.set(item.date, (paidByDate.get(item.date) || 0) + 1);
    const total = sumDays(data.current), before = sumDays(data.previous);
    const titles = new Map(listings.map(listing => [listing.id, listing.title]));
    const searches = Object.values(total.cities).reduce((sum, count) => sum + count, 0);
    return {
      dates, byDate, paidByDate, total, before, searches,
      paidCount: inCurrent.length, paidBefore: inPrevious.length,
      revenue: inCurrent.reduce((sum, item) => sum + item.amount, 0),
      conversion: total.sessions ? inCurrent.length / total.sessions * 100 : 0,
      conversionBefore: before.sessions ? inPrevious.length / before.sessions * 100 : 0,
      funnel: [...FUNNEL_STEPS.map(step => ({ label: FUNNEL_LABELS[step], count: total.funnel[step] || 0 })), { label: 'Réservation payée', count: inCurrent.length }],
      sources: topEntries(total.sources, 6).map(row => ({ label: SOURCE_LABELS[row.key] || row.key, count: row.count })),
      pages: topEntries(total.pages, 7).map(row => ({ label: PAGE_LABELS[row.key] || row.key, count: row.count })),
      cities: topEntries(total.cities, 7).map(row => ({ label: row.key, count: row.count })),
      listings: topEntries(total.listings, 6).map(row => ({ label: row.key === 'Autres' ? 'Autres' : titles.get(row.key) || 'Annonce retirée', count: row.count })),
    };
  }, [data, includeTests, listings]);

  return <section className="space-y-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 className="text-xl font-bold text-haven-navy">Audience</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">Mesure anonyme et sans cookie, exemptée de consentement par la CNIL : aucun identifiant, aucune adresse IP, aucune donnée transmise à un tiers. Seuls des totaux par jour sont conservés (25 mois).</p>
      </div>
      {/* Filters: one row above the charts. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-gray-200 bg-white p-1" role="group" aria-label="Période">
          {PERIODS.map(period => <button key={period.days} type="button" aria-pressed={days === period.days} onClick={() => setDays(period.days)}
            className={`min-h-9 rounded-full px-3 text-sm font-semibold ${days === period.days ? 'bg-haven-navy text-white' : 'text-gray-600 hover:text-haven-navy'}`}>{period.label}</button>)}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={includeTests} onChange={event => setIncludeTests(event.target.checked)} /> Paiements de test</label>
        <button type="button" onClick={() => void load()} aria-label="Actualiser" className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-gray-200 text-haven-navy">{loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}</button>
      </div>
    </div>

    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {!view && !error && <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Chargement de l’audience…</p>}

    {view && <>
      {view.total.sessions === 0 && <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-sm text-gray-500">Aucune visite enregistrée sur cette période pour l’instant. La mesure démarre avec les prochaines visites ; les chiffres apparaissent ici en une minute environ.</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Visites" value={number(view.total.sessions)} current={view.total.sessions} previous={view.before.sessions} hint={`${number(view.total.pageviews)} pages vues · ${view.total.sessions ? (view.total.pageviews / view.total.sessions).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : '0'} par visite`} />
        <Kpi label="Réservations payées" value={number(view.paidCount)} current={view.paidCount} previous={view.paidBefore} hint={`${formatEuros(view.revenue)} encaissés`} />
        <Kpi label="Taux de conversion" value={percent(view.conversion)} current={view.conversion} previous={view.conversionBefore} hint="Réservations payées / visites" />
        <Kpi label="Inscriptions" value={number(view.total.signups)} current={view.total.signups} previous={view.before.signups} hint={`${number(view.searches)} recherches, dont ${number(view.total.recurringSearches)} récurrentes`} />
      </div>

      <Card title="Visites par jour" subtitle="Survolez la courbe (ou utilisez les flèches du clavier) pour le détail d’une journée.">
        <DailyChart dates={view.dates} byDate={view.byDate} paidByDate={view.paidByDate} />
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-gray-500 hover:text-haven-navy">Voir les chiffres jour par jour</summary>
          <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-gray-100">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-gray-50 text-gray-500"><tr><th className="p-2">Jour</th><th className="p-2 text-right">Visites</th><th className="p-2 text-right">Pages vues</th><th className="p-2 text-right">Réservations payées</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{[...view.dates].reverse().map(date => <tr key={date}><td className="p-2 first-letter:uppercase">{dayLabel(date, true)}</td><td className="p-2 text-right">{number(view.byDate.get(date)?.sessions || 0)}</td><td className="p-2 text-right">{number(view.byDate.get(date)?.pageviews || 0)}</td><td className="p-2 text-right">{number(view.paidByDate.get(date) || 0)}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </Card>

      <Card title="Parcours de réservation" subtitle="Nombre de visites ayant atteint chaque étape, et part des visites. Les « Réservation payée » viennent des paiements réellement encaissés.">
        <Funnel counts={view.funnel} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="D’où viennent les visiteurs" subtitle="Site d’origine ou campagne (utm_source)."><BarList rows={view.sources} total={view.total.sessions} empty="Pas encore de visite." /></Card>
        <Card title="Appareils"><Devices devices={view.total.devices} /></Card>
        <Card title="Villes recherchées" subtitle="Ville saisie dans la recherche, jamais une adresse."><BarList rows={view.cities} total={view.searches} empty="Aucune recherche sur la période." /></Card>
        <Card title="Logements les plus consultés" subtitle="Une consultation par visite et par logement."><BarList rows={view.listings} total={Object.values(view.total.listings).reduce((sum, count) => sum + count, 0)} empty="Aucune fiche consultée sur la période." /></Card>
        <Card title="Pages les plus vues"><BarList rows={view.pages} total={view.total.pageviews} empty="Aucune page vue sur la période." /></Card>
        <Card title="Heures de visite" subtitle="Heure de Paris."><Hours hours={view.total.hours} /></Card>
      </div>
    </>}
  </section>;
}
