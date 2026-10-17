import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '../services/serverApi';
import type { ReservationConfirmation } from '../services/reservationFulfillment';

export async function downloadPaymentReceipt(bookingId: string) {
  const response = await authenticatedFetch(`/api/bookings/${encodeURIComponent(bookingId)}/confirmation?format=pdf`);
  if (!response.ok) throw new Error('Impossible de télécharger le justificatif.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a'); link.href = url; link.download = `Haven-justificatif-${bookingId}.pdf`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export function ReservationInformation({ bookingId }: { bookingId: string }) {
  const [data, setData] = useState<(ReservationConfirmation & { instructions: string; emailStatus: string; emailConfigured: boolean; bookingStatus: string }) | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await authenticatedFetch(`/api/bookings/${encodeURIComponent(bookingId)}/confirmation`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (active) { setData(result); setError(''); }
      } catch (error) { if (active) setError(error instanceof Error ? error.message : 'Informations indisponibles.'); }
    };
    void load();
    const timer = setInterval(load, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [bookingId]);
  if (!data) return <p className="text-sm text-haven-stone">{error || 'Chargement des informations du séjour…'}</p>;
  return <div className="space-y-5 text-sm text-haven-navy">
    {data.isTest && <p className="rounded-xl bg-amber-50 p-3">Réservation de test : aucun paiement réel.</p>}
    {data.bookingStatus === 'CANCELLED' && <p className="text-haven-red font-bold">Cette réservation est annulée.</p>}
    <div><h4 className="font-bold">Adresse exacte</h4><p>{data.address || 'À préciser par le propriétaire.'}</p><p className="mt-1">Arrivée à partir de {data.checkInTime} · Départ avant {data.checkOutTime}</p></div>
    <div><h4 className="font-bold">Règles communes Haven</h4><ul className="list-disc pl-5 space-y-2 mt-2">{data.rules.map(rule => <li key={rule}>{rule}</li>)}</ul></div>
    {data.bookingStatus === 'CONFIRMED' && <div className="rounded-xl bg-blue-50 p-4">
      <h4 className="font-bold">Votre entrée dans le logement</h4>
      {data.instructions ? <p className="whitespace-pre-line mt-2">{data.instructions}</p> : <p className="mt-2">Vous recevrez les informations d’entrée 72 heures avant votre arrivée. Pour une réservation à moins de 72 heures de l’arrivée, l’envoi est prévu dès confirmation.{Date.now() >= new Date(data.instructionsDueAt).getTime() ? ' Le propriétaire doit encore compléter les consignes. Contactez-le depuis la messagerie.' : ''}</p>}
    </div>}
    <p className="text-haven-stone">{data.emailStatus === 'SENT' ? 'E-mail de confirmation envoyé.' : data.emailConfigured ? 'E-mail de confirmation en attente d’envoi.' : 'Mode test : l’envoi des e-mails reste en attente de configuration.'}</p>
    {error && <p role="alert" className="text-haven-red">{error}</p>}
    <button className="w-full border rounded-xl p-3 font-bold hover:bg-gray-50" onClick={() => void downloadPaymentReceipt(bookingId).catch(error => setError(error.message))}>Télécharger le justificatif {data.isTest ? 'de simulation' : 'de paiement'}</button>
  </div>;
}

export function ReservationInformationDisclosure({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  return <details className="rounded-xl border p-4 text-left" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer font-bold text-sm">Informations du séjour et justificatif</summary>
    {open && <div className="mt-4"><ReservationInformation bookingId={bookingId} /></div>}
  </details>;
}
