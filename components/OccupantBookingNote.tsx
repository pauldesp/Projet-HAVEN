import { useState } from 'react';
import { toast } from 'sonner';
import { authenticatedFetch } from '../services/serverApi';
import type { Booking } from '../types';

/** Booking made for someone else, in the space of the account that booked: who stays, and the stay link again. */
export function OccupantBookingNote({ booking }: { booking: Booking }) {
  const [sending, setSending] = useState(false);
  const occupant = booking.occupant!;
  const linkUseful = booking.paymentStatus === 'PAID' && ['CONFIRMED', 'COMPLETED'].includes(booking.status);
  const resend = async () => {
    setSending(true);
    try {
      const response = await authenticatedFetch(`/api/bookings/${encodeURIComponent(booking.id)}/occupant-link`, { method: 'POST', body: '{}' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Le lien n’a pas pu être renvoyé.');
      toast.success(`Un nouveau lien a été envoyé à ${occupant.email}.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Le lien n’a pas pu être renvoyé.'); }
    finally { setSending(false); }
  };
  return <div className="mt-4 rounded-xl bg-haven-sand p-3 text-xs leading-relaxed text-gray-700">
    <p><span className="font-semibold text-haven-ink">Réservé pour {occupant.firstName} {occupant.lastName}</span>{occupant.minor ? ' (mineur)' : ''} · {occupant.email}</p>
    <p className="mt-1">L’occupant accède à son espace séjour par le lien reçu par e-mail : consignes, états des lieux, messages. Vous restez responsable de la réservation.</p>
    {linkUseful && <button type="button" disabled={sending} onClick={() => void resend()} className="mt-2 font-semibold text-haven-ink underline underline-offset-2 disabled:opacity-50">{sending ? 'Envoi…' : 'Renvoyer le lien à l’occupant'}</button>}
  </div>;
}
