/**
 * Price comparison on the home page (comparative advertising, Code de la consommation L122-1 to L122-7).
 * Every figure must come from a dated survey kept as proof (screenshots with address, dates and total price
 * including all mandatory fees). Update this object, and only this object, after each new survey.
 * A `null` field is left out of the notice: fill it in before going live.
 * Survey of 15 November 2026: proofs and every price seen in `preuves-comparaison/` (kept out of Git).
 */
export const PRICE_COMPARISON = {
  /** Day the prices were read (YYYY-MM-DD). */
  surveyedOn: '2026-11-15' as string | null,
  stay: { city: 'La Rochelle', startDate: '2026-11-22', endDate: '2026-11-27', nights: 5, guests: 1 },
  // Cheapest rate shown on Booking.com for 1 adult, taxes and fees included (no breakfast, non-refundable).
  hotel: { priceEuros: 174, label: 'Hôtel low cost', example: 'hôtel F1', establishment: 'hotelF1 La Rochelle Angoulins, à Angoulins-sur-Mer (6,8 km de La Rochelle)' as string | null, description: 'Chambre seule, WC et salle de bain sur le palier' },
  // Cheapest offers available on the exact dates in La Rochelle, total price with taxes and fees.
  airbnbStudio: { priceEuros: 267, label: 'studio seul', description: 'Logement entier' },
  airbnbRoom: { priceEuros: 205, label: 'chambre privée', description: 'Chambre dans un logement, salle de bain partagée' },
  // To be read on Haven for the same dates (Firestore unavailable during the survey). Null hides the figure and the badge.
  haven: { priceEuros: null as number | null, example: 'Coloc Martin' as string | null, description: 'Chambre privée en colocation, cuisine et salle de bain partagées' },
} as const;

/** The "cheapest" badge is shown only when Haven really is below every other offer of the survey. */
export function havenIsCheapest(data = PRICE_COMPARISON) {
  const haven = data.haven.priceEuros;
  return haven !== null && [data.hotel.priceEuros, data.airbnbStudio.priceEuros, data.airbnbRoom.priceEuros].every(price => haven < price);
}

const longDate = (value: string, withWeekday = false) => new Date(`${value}T12:00:00Z`).toLocaleDateString('fr-FR', { ...(withWeekday ? { weekday: 'long' } : {}), day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** The stay compared, as shown above the cards. */
export function comparisonStayLabel(data = PRICE_COMPARISON) {
  const { stay } = data;
  return `Séjour de ${stay.nights} nuits à ${stay.city} pour ${stay.guests} personne, du ${longDate(stay.startDate, true).replace(/ \d{4}$/, '')} au ${longDate(stay.endDate, true)}`;
}

/** The notice under the cards: survey date, scope of the prices, sources and their limits. */
export function comparisonNotice(data = PRICE_COMPARISON) {
  const parts = [
    `Prix totaux${data.surveyedOn ? ` relevés le ${longDate(data.surveyedOn)}` : ''} pour ce séjour, tous frais obligatoires inclus (frais de service, ménage et taxes).`,
    `Hôtel : ${data.hotel.establishment || data.hotel.example}.`,
    `Airbnb : offres les moins chères disponibles à ${data.stay.city} aux mêmes dates (${data.airbnbStudio.label}, ${data.airbnbRoom.label}).`,
    `Haven : ${data.haven.example ? `annonce « ${data.haven.example} »` : 'annonce publiée sur Haven'} aux mêmes dates.`,
    'Prix indicatifs, susceptibles d’évoluer selon les dates et les disponibilités. Haven n’est pas lié à Airbnb ni au groupe Accor.',
  ];
  return parts.join(' ');
}
