import { Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { OWNER_CLEANING_RULE, TENANT_CLEANING_RULE } from '../services/cleaningPolicy';

export function CleaningPolicyNotice({ audience = 'tenant' }: { audience?: 'tenant' | 'owner' }) {
  const { tr } = useLanguage();
  return <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 text-haven-navy">
    <h3 className="flex items-center gap-2 font-bold"><Sparkles size={20} />{tr('Ménage : des engagements partagés')}</h3>
    <dl className="mt-4 space-y-4 text-sm leading-relaxed">
      <div>
        <dt className="font-bold">{tr(audience === 'owner' ? 'Votre engagement : un ménage chaque semaine' : 'Le propriétaire : un ménage chaque semaine')}</dt>
        <dd className="mt-1 text-gray-600">{tr(audience === 'owner' ? 'En proposant votre logement sur Haven, vous vous engagez à faire réaliser un ménage chaque semaine, par vous-même ou par un prestataire. Cet entretien régulier garantit un niveau de propreté constant tout au long des séjours.' : OWNER_CLEANING_RULE)}</dd>
      </div>
      {audience === 'owner' && <div>
        <dt className="font-bold">{tr('Une organisation à prévoir')}</dt>
        <dd className="mt-1 text-gray-600">{tr('Prévoyez le passage, notamment pour la cuisine, les sanitaires et les espaces communs, et indiquez son organisation dans le guide du séjour. Le forfait ménage, facturé une fois par location, contribue à cet entretien.')}</dd>
      </div>}
      <div>
        <dt className="font-bold">{tr('Le locataire : une remise en état avant de partir')}</dt>
        <dd className="mt-1 text-gray-600">{tr(audience === 'owner' ? 'Le locataire laisse sa chambre propre et rangée et nettoie les espaces qu’il a utilisés pour accueillir le suivant dans de bonnes conditions. Ces gestes complètent votre ménage hebdomadaire ; ils ne le remplacent pas.' : TENANT_CLEANING_RULE)}</dd>
      </div>
    </dl>
  </section>;
}
