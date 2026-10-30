import { useLanguage } from '../contexts/LanguageContext';
import { Listing } from '../types';

export const ARRIVAL_METHODS = {
  SELF_CHECK_IN: 'Arrivée autonome',
  HOST_WELCOME: 'Accueil par le propriétaire ou son représentant',
  TO_COORDINATE: 'Arrivée à organiser avec le propriétaire'
} as const;

type PublicInfo = Pick<Listing, 'neighborhood' | 'arrivalMethod'>;

export function ListingPublicInfoFields({ value, onChange }: { value: PublicInfo; onChange: (updates: PublicInfo) => void }) {
  const { tr } = useLanguage();
  return <section className="space-y-5 rounded-3xl bg-gray-50 p-6">
    <div>
      <label className="block text-sm font-bold text-haven-navy">{tr("Quartier ou secteur")} <input value={value.neighborhood || ''} maxLength={100} onChange={event => onChange({ neighborhood: event.target.value })} placeholder={tr("Ex. Centre-ville, Les Minimes…")} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 font-normal" />
      </label>
      <p className="mt-2 text-sm text-haven-stone">{tr("Visible dans l’annonce. Indiquez uniquement le quartier, sans numéro, rue ni code d’accès.")}</p>
    </div>
    <div>
      <label className="block text-sm font-bold text-haven-navy">{tr("Modalité d’arrivée")} <select value={value.arrivalMethod || 'TO_COORDINATE'} onChange={event => onChange({ arrivalMethod: event.target.value as Listing['arrivalMethod'] })} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3 font-normal">
          {Object.entries(ARRIVAL_METHODS).map(([key, label]) => <option key={key} value={key}>{tr(label)}</option>)}
        </select>
      </label>
      <p className="mt-2 text-sm text-haven-stone">{tr("Cette information est publique. Les instructions détaillées et codes restent dans les consignes privées d’entrée.")}</p>
    </div>
  </section>;
}
