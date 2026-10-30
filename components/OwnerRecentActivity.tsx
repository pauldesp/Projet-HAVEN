import { CalendarDays, CheckCircle, LogOut, XCircle } from 'lucide-react';
import type { Booking, Listing, User } from '../types';
import { countNights } from '../services/stay';

type ActivityBooking = Booking & { tenant: User };
const activityDate = (booking: Booking) => (booking.status === 'CANCELLED' ? booking.cancellation?.cancelledAt : booking.status === 'COMPLETED' ? booking.completedAt : booking.paidAt) || booking.paidAt || booking.createdAt;
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function OwnerRecentActivity({ bookings, listings, onView }: { bookings: ActivityBooking[]; listings: Listing[]; onView: (booking: Booking) => void }) {
  const recent = [...bookings].sort((a, b) => Date.parse(activityDate(b)) - Date.parse(activityDate(a))).slice(0, 5);
  return <div className="space-y-3">
    {recent.map(booking => {
      const listing = listings.find(item => item.id === booking.listingId);
      const cancelled = booking.status === 'CANCELLED';
      const completed = booking.status === 'COMPLETED';
      const Icon = cancelled ? XCircle : completed ? LogOut : CheckCircle;
      const title = cancelled ? 'Réservation annulée' : completed ? 'Séjour terminé' : 'Réservation confirmée';
      const room = booking.roomName || listing?.rooms.find(item => item.id === booking.roomId)?.name;
      const nights = countNights(booking.startDate, booking.endDate);
      return <article key={booking.id} className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white ${cancelled ? 'text-haven-red' : completed ? 'text-gray-500' : 'text-green-600'}`}><Icon size={18} aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h4 className="text-sm font-bold text-haven-navy">{title}</h4>
              <time dateTime={activityDate(booking)} className="text-[11px] text-gray-400">{new Date(activityDate(booking)).toLocaleDateString('fr-FR')}</time>
            </div>
            <p className="mt-1 break-words text-sm font-medium text-haven-navy">{listing?.title || booking.listingTitle || 'Logement'}{room ? ` · ${room}` : ''}</p>
            <p className="mt-1 text-xs text-gray-500">{booking.tenant.firstName || 'Locataire'}{listing?.city ? ` · ${listing.city}` : ''}</p>
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-gray-600"><CalendarDays size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{dateLabel(booking.startDate)} au {dateLabel(booking.endDate)}{nights ? ` · ${nights} ${nights === 1 ? 'nuit' : 'nuits'}` : ''}</span></p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200/70 pt-3">
              <p className="text-xs text-gray-500">Total du séjour <span className="ml-1 font-bold text-haven-navy">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(booking.totalPrice)}</span>{booking.paymentIsTest && <span className="ml-2 text-amber-700">Simulation</span>}</p>
              <button type="button" onClick={() => onView(booking)} className="text-xs font-bold text-haven-navy underline underline-offset-4 hover:text-haven-red">Voir les réservations</button>
            </div>
          </div>
        </div>
      </article>;
    })}
    {!recent.length && <p className="py-4 text-center text-gray-400">Aucune activité récente.</p>}
  </div>;
}
