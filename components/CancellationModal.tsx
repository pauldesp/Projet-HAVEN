import React, { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { Booking } from '../types';
import { apiService } from '../services/api';
import { getCancellationTerms } from '../services/cancellationPolicy';
import type { CancellationActor } from '../services/cancellationPolicy';
import { userFacingErrorMessage } from '../services/errorHandling';
import { Button } from './Button';

interface CancellationModalProps {
  booking: Booking;
  actor: CancellationActor;
  onClose: () => void;
  onCancelled: (bookingId: string, cancellation: NonNullable<Booking['cancellation']>) => void;
}

const REASONS = [
  'Changement de projet',
  'Problème de calendrier',
  'Raison personnelle',
  'Le logement n’est plus disponible',
  'Autre motif',
];

export const CancellationModal: React.FC<CancellationModalProps> = ({ booking, actor, onClose, onCancelled }) => {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const terms = useMemo(() => getCancellationTerms(booking, actor), [booking, actor]);

  const fullReason = `${reason}${details.trim() ? ` — ${details.trim()}` : ''}`;
  const submit = async () => {
    if (!terms.canCancel || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await apiService.bookings.cancel(booking.id, fullReason);
      onCancelled(booking.id, result.cancellation);
      onClose();
    } catch (err) {
      setError(userFacingErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cancel-booking-title" className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-haven-navy/45 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-[2rem] sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="cancel-booking-title" className="font-heading text-2xl font-bold text-haven-navy">Annuler le séjour</h2>
            <p className="mt-1 text-sm text-gray-500">Cette action libère la chambre pour les dates concernées.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-haven-navy"><X size={20} /></button>
        </div>

        <div className={`mb-5 rounded-2xl border p-4 ${terms.refundAmount > 0 ? 'border-green-100 bg-green-50' : 'border-amber-100 bg-amber-50'}`}>
          <div className="flex gap-3">
            <AlertTriangle size={20} className={terms.refundAmount > 0 ? 'text-green-700' : 'text-amber-700'} />
            <div>
              <p className="font-bold text-haven-navy">{terms.label}</p>
              <p className="mt-1 text-sm text-gray-600">{terms.detail}</p>
              {terms.refundAmount > 0 && <p className="mt-2 text-sm font-bold text-green-700">Montant remboursé : {terms.refundAmount} €</p>}
            </div>
          </div>
        </div>

        {!terms.canCancel ? (
          <Button fullWidth onClick={onClose} className="h-12 rounded-xl">Fermer</Button>
        ) : (
          <>
            <label className="block text-sm font-bold text-haven-navy">Motif de l’annulation</label>
            <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 block w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-haven-navy">
              {REASONS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <label className="mt-4 block text-sm font-bold text-haven-navy" htmlFor="cancellation-details">Précision facultative</label>
            <textarea id="cancellation-details" value={details} onChange={(event) => setDetails(event.target.value)} maxLength={400} rows={3} placeholder="Expliquez brièvement la situation…" className="mt-2 block w-full resize-none rounded-xl border border-gray-200 px-3 py-3 text-sm text-haven-navy" />
            {error && <p role="alert" className="mt-3 text-sm font-medium text-haven-red">{error}</p>}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="h-12 rounded-xl">Conserver</Button>
              <Button variant="primary" onClick={submit} disabled={isSubmitting} className="h-12 rounded-xl bg-haven-red hover:bg-haven-red/90">
                {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Annulation…</> : 'Confirmer'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
