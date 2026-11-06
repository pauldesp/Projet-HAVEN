import { useEffect, useState } from 'react';
import type { Booking } from '../types';
import { bookingDeadline } from '../services/bookingLifecycle';
import { installmentDateLabel, installmentDeadlineLabel, installmentState } from '../services/recurringInstallments';

export function BookingCountdown({ booking }: { booking: Booking }) {
  const [now, setNow] = useState(Date.now());
  const deadline = bookingDeadline(booking);
  const installment = installmentState(booking, new Date(now));
  useEffect(() => {
    if (deadline === null || installment === 'SCHEDULED' || installment === 'DUE' || installment === 'FAILED') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline, installment]);
  if (installment === 'SCHEDULED') return <p className="mt-2 text-xs font-medium text-gray-600">Prélèvement automatique le {installmentDateLabel(booking.installmentDueDate!)}</p>;
  if (installment === 'DUE') return <p className="mt-2 text-xs font-medium text-gray-600">Prélèvement automatique en cours</p>;
  if (installment === 'FAILED') return <p className="mt-2 text-xs font-medium text-red-600">Paiement à finaliser avant le {installmentDeadlineLabel(booking)}</p>;
  if (deadline === null) return null;
  const seconds = Math.max(0, Math.floor((deadline - now) / 1000));
  if (installment === 'AWAITING_FIRST') return <p className="mt-2 text-xs font-medium text-amber-700">{seconds ? 'Dates retenues jusqu’au paiement du premier séjour' : 'Délai de paiement expiré'}</p>;
  return <p className={`mt-2 text-xs font-medium ${seconds ? 'text-amber-700' : 'text-red-600'}`}>
    {seconds ? `Paiement à finaliser sous ${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min ${seconds % 60} s` : 'Délai de paiement expiré'}
  </p>;
}
