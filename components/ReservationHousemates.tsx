import { translateActivity } from '../services/uiTranslations';
import { useLanguage } from '../contexts/LanguageContext';
import { useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import type { HousematePreview } from '../types';
import { authenticatedFetch } from '../services/serverApi';

export function ReservationHousemates({ bookingId }: { bookingId: string }) {
  const { tr, language } = useLanguage();
  const [housemates, setHousemates] = useState<HousematePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setHousemates([]); setError('');
    const load = async () => {
      try {
        const response = await authenticatedFetch(`/api/bookings/${encodeURIComponent(bookingId)}/housemates`);
        if (!response.ok) throw new Error(tr("Les profils sont momentanément indisponibles."));
        const data = await response.json();
        if (active) { setHousemates(data.housemates || []); setError(''); }
      } catch (error) { if (active) setError(error instanceof Error ? error.message : tr("Profils indisponibles.")); }
      finally { if (active) setLoading(false); }
    };
    void load();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [bookingId]);
  return <section className="rounded-2xl border border-gray-200 p-5" aria-live="polite">
    <h4 className="flex items-center gap-2 font-bold text-haven-navy"><Users size={19} aria-hidden="true" />{tr("Vos colocataires pendant le séjour")}</h4>
    <p className="mt-2 text-sm leading-relaxed text-gray-500">{tr("Les colocataires qui partageront le logement aux mêmes dates que vous.")}</p>
    {loading ? <p role="status" className="mt-4 flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" />{tr("Chargement des profils…")}</p> : error ? <p className="mt-4 text-sm text-gray-500">{error}</p> : housemates.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {housemates.map(profile => <div key={profile.id} className="flex items-start gap-3 rounded-xl bg-gray-50 p-4">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-haven-navy font-bold text-white" aria-hidden="true">
          {profile.firstName.charAt(0).toUpperCase()}
          {profile.avatarUrl && <img src={profile.avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={event => { event.currentTarget.style.display = 'none'; }} />}
        </div>
        <div className="min-w-0"><p className="break-words text-sm font-bold text-haven-navy">{profile.firstName}{profile.age ? ` · ${profile.age} ${language === 'en' ? 'years old' : 'ans'}` : ''}</p>
          {profile.activity && <p className="mt-1 break-words text-sm text-gray-500">{translateActivity(profile.activity, language)}</p>}
          {!!profile.interests?.length && <p className="mt-2 text-xs text-haven-navy">{profile.interests.map(tr).join(' · ')}</p>}
          <p className="mt-2 text-xs text-gray-500">{profile.coverage === 'FULL' ? tr("Présent tout votre séjour") : tr("Quelques nuits en commun")}</p>
        </div>
      </div>)}
    </div> : <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">{tr("Aucun autre colocataire confirmé pour ces dates.")}</p>}
    <p className="mt-4 text-xs leading-relaxed text-gray-400">{tr("Seuls les colocataires avec une réservation confirmée aux mêmes dates apparaissent ici.")}</p>
  </section>;
}
