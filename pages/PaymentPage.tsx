import { ReservationInformation } from '../components/ReservationInformation';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authenticatedFetch } from '../services/serverApi';
import type { CheckoutDetails } from '../services/paymentCheckout';
import { PaymentCheckoutView } from '../components/PaymentCheckoutView';

export const PaymentPage: React.FC = () => {
  const { bookingId = '' } = useParams();
  const [details, setDetails] = useState<CheckoutDetails | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true;
    setDetails(null); setError('');
    void authenticatedFetch(`/api/payments/${encodeURIComponent(bookingId)}`).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible de charger le paiement.');
      if (active) setDetails(data);
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : 'Le paiement est indisponible.'); });
    return () => { active = false; };
  }, [bookingId]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const pay = async () => {
    if (!details || busy) return;
    setBusy(true); setError('');
    try {
      if (details.mode === 'SIMULATION') {
        const response = await authenticatedFetch(`/api/payments/${encodeURIComponent(bookingId)}/simulate`, { method: 'POST', body: '{}' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Impossible de confirmer le paiement de test.');
        if (data.status !== 'CONFIRMED') throw new Error('La réservation n’est pas encore confirmée. Actualisez la page.');
        setDetails(previous => previous ? { ...previous, booking: { ...previous.booking, status: 'CONFIRMED', paymentStatus: 'PAID', paidAt: data.paidAt, paymentIsTest: true, paymentProvider: 'SIMULATION' } } : previous);
      } else {
        const response = await authenticatedFetch('/api/create-checkout-session', { method: 'POST', body: JSON.stringify({ bookingId }) });
        const data = await response.json();
        if (!response.ok || !data.url) throw new Error(data.error || 'Le paiement sécurisé est indisponible.');
        window.location.assign(data.url);
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Le paiement est indisponible. Vous pouvez réessayer.'); }
    finally { setBusy(false); }
  };
  if (!details) return <div className="mx-auto max-w-lg px-6 py-24 text-center">{error ? <><h1 className="text-2xl font-bold">Paiement indisponible</h1><p role="alert" className="my-5 text-gray-500">{error}</p><Link to="/dashboard" className="font-bold underline">Retour à mes séjours</Link></> : <Loader2 className="mx-auto animate-spin" aria-label="Chargement du paiement" />}</div>;
  return <><PaymentCheckoutView details={details} busy={busy} error={error} expired={details.expiresAt !== null && now >= details.expiresAt} onPay={() => void pay()} />
    {details.booking.paymentStatus === 'PAID' && <section className="mx-auto max-w-2xl px-6 pb-16"><ReservationInformation bookingId={bookingId} /></section>}
  </>;
};
