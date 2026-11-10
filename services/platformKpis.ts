import type { Booking, Listing } from '../types';
import { countNights, localDateKey } from './stay';

const addDays = (date: string, days: number) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };

/** Key figures of the platform, computed from bookings and listings. */
export function platformKpis(bookings: Booking[], listings: Listing[], now = new Date(), includeTests = true) {
  const today = localDateKey(now);
  const scope = bookings.filter(booking => includeTests || !(booking.paymentIsTest || booking.paymentProvider === 'SIMULATION'));
  const paid = scope.filter(booking => booking.paymentStatus === 'PAID');
  const kept = paid.filter(booking => booking.status !== 'CANCELLED');
  const online = listings.filter(listing => listing.status === 'APPROVED');
  // Occupancy of the next 30 nights: reserved room-nights over available room-nights.
  const horizon = addDays(today, 30);
  const roomNights = online.reduce((sum, listing) => sum + listing.rooms.length * 30, 0);
  const reservedNights = scope.filter(booking => ['CONFIRMED', 'COMPLETED'].includes(booking.status) || (booking.status === 'PENDING' && booking.seriesScheduled))
    .reduce((sum, booking) => {
      const start = booking.startDate > today ? booking.startDate : today;
      const end = booking.endDate < horizon ? booking.endDate : horizon;
      return start < end ? sum + countNights(start, end) : sum;
    }, 0);
  const byCity = new Map<string, { revenue: number; commission: number; stays: number }>();
  for (const booking of kept) {
    const city = online.concat(listings).find(listing => listing.id === booking.listingId)?.city || 'Autre';
    const entry = byCity.get(city) || { revenue: 0, commission: 0, stays: 0 };
    entry.revenue += booking.totalPrice; entry.commission += booking.platformFee; entry.stays += 1;
    byCity.set(city, entry);
  }
  const stays = kept.map(booking => countNights(booking.startDate, booking.endDate));
  return {
    onlineListings: online.length,
    onlineRooms: online.reduce((sum, listing) => sum + listing.rooms.length, 0),
    occupancyNext30: roomNights ? Math.round(reservedNights / roomNights * 100) : 0,
    paidStays: kept.length,
    cancellationRate: paid.length ? Math.round((paid.length - kept.length) / paid.length * 100) : 0,
    recurringShare: kept.length ? Math.round(kept.filter(booking => booking.seriesId).length / kept.length * 100) : 0,
    averageNights: stays.length ? Math.round(stays.reduce((sum, value) => sum + value, 0) / stays.length * 10) / 10 : 0,
    gapStays: kept.filter(booking => {
      const listing = listings.find(item => item.id === booking.listingId);
      return listing && countNights(booking.startDate, booking.endDate) < (listing.minStay || 4);
    }).length,
    byCity: [...byCity.entries()].map(([city, values]) => ({ city, ...values })).sort((a, b) => b.revenue - a.revenue),
  };
}
