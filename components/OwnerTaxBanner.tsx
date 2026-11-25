import { useEffect, useState } from 'react';
import { authenticatedFetch } from '../services/serverApi';

/** Shown only after a first paid booking, while the owner's status and tax number are missing. */
export function OwnerTaxBanner({ onOpen }: { onOpen: () => void }) {
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  useEffect(() => {
    void authenticatedFetch('/api/owners/me/tax-profile').then(response => response.ok ? response.json() : null)
      .then(data => setDeadlineAt(data?.requested && !data.complete ? data.deadlineAt : null)).catch(() => undefined);
  }, []);
  if (!deadlineAt) return null;
  const late = Date.now() >= Date.parse(deadlineAt);
  return <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-haven-gray bg-haven-sand p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
    <div>
      <h2 className="font-semibold text-haven-ink">{late ? 'Vos versements sont suspendus' : 'Une dernière information pour vos revenus'}</h2>
      <p className="text-sm text-gray-600">{late ? 'Indiquez votre statut et votre numéro fiscal : vos versements reprendront aussitôt.' : `Indiquez votre statut et votre numéro fiscal avant le ${new Date(deadlineAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}. Cela prend 2 minutes.`}</p>
    </div>
    <button type="button" onClick={onOpen} className="min-h-11 shrink-0 rounded-full bg-haven-navy px-5 text-sm font-semibold text-white">Compléter</button>
  </div>;
}
