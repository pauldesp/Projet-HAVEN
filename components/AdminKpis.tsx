import { useState } from 'react';
import { ScrollableRow } from './ScrollableRow';
import type { Booking, Listing } from '../types';
import { platformKpis } from '../services/platformKpis';
import { formatEuros } from '../services/money';

/** Key figures of the platform at the top of the Stats tab. */
export function AdminKpis({ bookings, listings }: { bookings: Booking[]; listings: Listing[] }) {
  const [includeTests, setIncludeTests] = useState(true);
  const kpis = platformKpis(bookings, listings, new Date(), includeTests);
  return <section className="mb-8 space-y-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-card sm:p-8">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-xl font-bold text-haven-ink">Indicateurs clés</h2>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeTests} onChange={event => setIncludeTests(event.target.checked)} /> Inclure les tests et simulations</label>
    </div>
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[['Annonces en ligne', `${kpis.onlineListings} (${kpis.onlineRooms} chambres)`], ['Occupation des 30 prochains jours', `${kpis.occupancyNext30} %`], ['Séjours payés maintenus', String(kpis.paidStays)], ['Taux d’annulation', `${kpis.cancellationRate} %`],
        ['Part des séjours récurrents', `${kpis.recurringShare} %`], ['Durée moyenne', `${kpis.averageNights} nuits`], ['Séjours courts entre deux locations', String(kpis.gapStays)], ['Villes actives', String(kpis.byCity.length)]].map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-gray-200 p-4"><dt className="text-sm text-gray-500">{label}</dt><dd className="mt-1 text-lg font-bold text-haven-ink">{value}</dd></div>
      ))}
    </dl>
    {kpis.byCity.length > 0 && <ScrollableRow label="colonnes" fadeFrom="from-white">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-gray-500"><tr><th className="py-2">Ville</th><th>Séjours</th><th>Encaissé</th><th>Commission Haven</th></tr></thead>
        <tbody className="divide-y divide-gray-100">{kpis.byCity.map(row => <tr key={row.city}><td className="py-2 font-semibold text-haven-ink">{row.city}</td><td>{row.stays}</td><td>{formatEuros(row.revenue)}</td><td>{formatEuros(row.commission)}</td></tr>)}</tbody>
      </table>
    </ScrollableRow>}
    <p className="text-xs text-gray-500">Visites, parcours de réservation et taux de conversion : onglet Audience.</p>
  </section>;
}
