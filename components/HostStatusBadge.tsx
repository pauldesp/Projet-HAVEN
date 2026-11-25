import { useEffect, useState } from 'react';
import { BadgeCheck } from 'lucide-react';

/** "Hôte particulier" or "Hôte professionnel", shown to every visitor of a listing (consumer law L111-7). */
export function HostStatusBadge({ listingId }: { listingId: string }) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void fetch(`/api/listings/${encodeURIComponent(listingId)}/host-status`).then(response => response.ok ? response.json() : null)
      .then(data => { if (active) setLabel(data?.label || null); }).catch(() => undefined);
    return () => { active = false; };
  }, [listingId]);
  if (!label) return null;
  return <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-haven-sand px-4 py-2 text-sm font-medium text-haven-ink">
    <BadgeCheck size={16} aria-hidden="true" />{label}
  </p>;
}
