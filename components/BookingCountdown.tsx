import React, { useEffect, useState } from 'react';
import type { Booking } from '../types';
import { bookingDeadline } from '../services/bookingLifecycle';

export function BookingCountdown({ booking }: { booking: Booking }) {
  const [now, setNow] = useState(Date.now());
  const deadline = bookingDeadline(booking);
  useEffect(() => {
    if (deadline === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  if (deadline === null) return null;
  const seconds = Math.max(0, Math.floor((deadline - now) / 1000));
  return <p className={`mt-2 text-xs font-medium ${seconds ? 'text-amber-700' : 'text-red-600'}`}>
    {seconds ? `Paiement à finaliser sous ${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min ${seconds % 60} s` : 'Délai de paiement expiré'}
  </p>;
}
