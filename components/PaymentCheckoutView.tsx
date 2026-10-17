import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CreditCard, FlaskConical, Home, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';
import { BookingCountdown } from './BookingCountdown';
import { countNights } from '../services/stay';
import type { CheckoutDetails } from '../services/paymentCheckout';

const euros = (amount: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
const dateLabel = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export function PaymentCheckoutView({ details, busy, error, expired = false, onPay }: {
  details: CheckoutDetails; busy: boolean; error: string; expired?: boolean; onPay: () => void;
}) {
  const { booking, customer, listing, mode } = details;
  const simulation = mode === 'SIMULATION';
  const confirmed = ['CONFIRMED', 'COMPLETED'].includes(booking.status) && booking.paymentStatus === 'PAID';
  const nights = countNights(booking.startDate, booking.endDate);
  return <div className="min-h-screen bg-[#f8f7f5] text-haven-navy">
    <header className="border-b border-gray-200/70 bg-white px-5 sm:px-8"><div className="mx-auto flex h-24 max-w-5xl items-center justify-between gap-4">
      <Link to="/"><Logo className="h-11" /></Link>
      <span className="flex items-center gap-2 text-xs font-medium text-gray-500"><LockKeyhole size={15} />{simulation ? 'Environnement de test' : 'Paiement sécurisé'}</span>
    </div></header>
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <Link to={confirmed ? '/dashboard' : `/listing/${booking.listingId}`} className="mb-8 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-haven-navy"><ArrowLeft size={16} />{confirmed ? 'Mes séjours' : 'Retour au logement'}</Link>
      {simulation && <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"><FlaskConical size={20} className="mt-0.5 shrink-0" /><div><p className="font-bold">Mode test — aucun débit bancaire</p><p className="mt-1 leading-relaxed">Les informations de carte sont fictives et préremplies. {confirmed ? 'Ce séjour a été confirmé pour tester le parcours.' : 'Le bouton ci-dessous simule le paiement et confirme le séjour pour les tests.'}</p></div></div>}
      <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <section>
          {confirmed ? <div className="rounded-3xl border border-green-100 bg-white p-7 sm:p-9">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600"><CheckCircle2 size={34} /></div>
            <h1 className="text-3xl font-bold leading-tight">{booking.status === 'COMPLETED' ? 'Votre séjour est terminé' : 'Votre réservation est confirmée'}</h1>
            <p className="mt-4 leading-relaxed text-gray-500">Votre séjour est maintenant visible dans votre espace et celui du propriétaire. Retrouvez-y les informations pour votre arrivée.</p>
            {booking.paymentIsTest && <p className="mt-4 text-sm font-medium text-amber-800">Confirmation de test : aucun paiement réel n’a été encaissé.</p>}
            <Link to="/dashboard" className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-haven-navy px-5 py-4 font-bold text-white">Voir mes séjours <ArrowRight size={18} /></Link>
          </div> : <>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Dernière étape</p>
            <h1 className="text-3xl font-bold sm:text-4xl">Confirmez votre séjour</h1>
            <p className="mt-3 leading-relaxed text-gray-500">{simulation ? 'Testez le paiement puis retrouvez votre réservation confirmée.' : 'Réglez votre séjour sur la page sécurisée de notre partenaire de paiement.'}</p>
            <form onSubmit={event => { event.preventDefault(); if (!busy && !expired) onPay(); }} className="mt-8 space-y-6 rounded-3xl border border-gray-200/80 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-bold"><CreditCard size={20} />Carte bancaire</h2><span className="rounded border border-gray-200 px-2 py-1 text-xs font-bold text-gray-500">{simulation ? 'CARTE DE TEST' : 'STRIPE'}</span></div>
              <label className="block text-sm font-semibold">Adresse e-mail<input readOnly value={customer.email} autoComplete="off" className="mt-2 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 font-normal text-gray-600" /></label>
              {simulation ? <>
                <label className="block text-sm font-semibold">Nom sur la carte<input readOnly value={customer.name || 'Carte de test HAVEN'} autoComplete="off" className="mt-2 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 font-normal text-gray-600" /></label>
                <label className="block text-sm font-semibold">Numéro de carte<div className="relative mt-2"><input readOnly value="4242 4242 4242 4242" aria-label="Numéro de carte fictif" autoComplete="off" className="block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 font-mono text-gray-600" /><CreditCard size={19} className="absolute right-4 top-4 text-gray-400" /></div></label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="text-sm font-semibold">Expiration<input readOnly value={`12 / ${String(new Date().getFullYear() + 3).slice(-2)}`} autoComplete="off" className="mt-2 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 font-normal text-gray-600" /></label>
                  <label className="text-sm font-semibold">Cryptogramme<input readOnly value="•••" aria-label="Cryptogramme fictif" autoComplete="off" className="mt-2 block w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 font-normal text-gray-600" /></label>
                </div>
              </> : <div className="rounded-xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-500"><ShieldCheck size={22} className="mb-2 text-haven-navy" />Vos coordonnées bancaires seront saisies directement sur la page Stripe et ne transiteront pas par Haven.</div>}
              {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm leading-relaxed text-red-700">{error}</p>}
              {expired && <p role="alert" className="text-sm text-red-700">Le délai de paiement est expiré. Revenez au logement pour recommencer votre réservation.</p>}
              <button type="submit" disabled={busy || expired} className="flex w-full items-center justify-center gap-2 rounded-xl bg-haven-navy px-4 py-4 font-bold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <><Loader2 size={19} className="animate-spin" />{simulation ? 'Confirmation en cours…' : 'Ouverture du paiement…'}</> : <><LockKeyhole size={17} />{simulation ? `Simuler le paiement de ${euros(booking.totalPrice)}` : `Continuer vers le paiement de ${euros(booking.totalPrice)}`}</>}</button>
              <p className="text-center text-xs leading-relaxed text-gray-400">{simulation ? 'Aucune donnée bancaire n’est saisie, transmise ou enregistrée.' : 'La réservation est confirmée uniquement après validation du paiement.'}</p>
            </form>
          </>}
        </section>
        <aside className="rounded-3xl border border-gray-200/80 bg-white p-6 shadow-sm sm:p-7 lg:sticky lg:top-8">
          <h2 className="mb-5 text-lg font-bold">Votre séjour</h2>
          <div className="flex gap-4">{listing.image ? <img src={listing.image} alt={listing.title} className="h-24 w-24 rounded-2xl object-cover" /> : <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-400"><Home size={30} /></div>}<div className="min-w-0 py-1"><p className="font-bold leading-snug">{listing.title}</p><p className="mt-1 text-sm text-gray-500">{listing.city}</p><p className="mt-2 text-sm text-gray-600">{booking.roomName || 'Chambre'}</p></div></div>
          <div className="my-6 grid grid-cols-2 gap-4 border-y border-gray-100 py-5"><div><p className="text-xs text-gray-400">Arrivée</p><p className="mt-1 text-sm font-semibold">{dateLabel(booking.startDate)}</p><p className="mt-1 text-xs text-gray-500">Dès {booking.checkInTime || '15:00'}</p></div><div><p className="text-xs text-gray-400">Départ</p><p className="mt-1 text-sm font-semibold">{dateLabel(booking.endDate)}</p><p className="mt-1 text-xs text-gray-500">Avant {booking.checkOutTime || '11:00'}</p></div></div>
          <dl className="space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-gray-500">Hébergement · {nights} nuit{nights > 1 ? 's' : ''}</dt><dd>{euros(booking.basePrice)}</dd></div><div className="flex justify-between gap-4"><dt className="text-gray-500">Ménage</dt><dd>{euros(booking.cleaningFee)}</dd></div><div className="flex justify-between gap-4"><dt className="text-gray-500">Frais de service Haven</dt><dd>{euros(booking.platformFee)}</dd></div><div className="flex justify-between gap-4 border-t border-gray-100 pt-5 text-lg font-bold"><dt>Total <span className="text-xs font-normal text-gray-400">EUR</span></dt><dd>{euros(booking.totalPrice)}</dd></div></dl>
          {confirmed ? <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-green-600"><Check size={17} />Réservation confirmée</p> : <BookingCountdown booking={booking} />}
          <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-gray-400"><ShieldCheck size={17} className="shrink-0" />{simulation ? 'Parcours de réservation identique au paiement réel. Aucun débit en mode test.' : 'Votre réservation et son montant sont vérifiés avant la confirmation.'}</p>
        </aside>
      </div>
    </main>
  </div>;
}
