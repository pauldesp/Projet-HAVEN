import { prepareImageForStorage } from '../services/images';
import type { RoomGuide } from '../services/roomGuide';
import { useLanguage } from '../contexts/LanguageContext';

export function RoomGuideFields({ name, value, onChange, onError, onPhotoBusy }: { name: string; value: RoomGuide; onChange: (value: RoomGuide) => void; onError: (message: string) => void; onPhotoBusy: (busy: boolean) => void }) {
  const { tr } = useLanguage();
  return <section className="rounded-2xl border border-gray-200 p-4 space-y-4">
    <h5 className="font-bold text-haven-navy">{name}</h5>
    <label className="block text-sm font-bold">{tr('Emplacement précis de la chambre')}<textarea rows={2} maxLength={1000} value={value.location} onChange={e => onChange({ ...value, location: e.target.value })} placeholder={tr('Ex. Au premier étage, deuxième porte à gauche, plaque Émeraude / n° 2.')} className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" /></label>
    <label className="block text-sm font-bold">{tr('Repère de la clé (facultatif)')}<input maxLength={300} value={value.keyLabel} onChange={e => onChange({ ...value, keyLabel: e.target.value })} placeholder={tr('Ex. Porte-clés Émeraude / n° 2.')} className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" /></label>
    <div className="grid gap-4 sm:grid-cols-2">{(['doorPhoto', 'interiorPhoto'] as const).map(field => <div key={field} className="min-w-0 space-y-2">
      <label className="block text-sm font-bold">{tr(field === 'doorPhoto' ? 'Photo de la porte et de son repère' : 'Photo de l’intérieur de la chambre')}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-xs font-normal" onChange={event => {
          const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
          onPhotoBusy(true);
          void prepareImageForStorage(file, 10 * 1024 * 1024).then(photo => { if (photo.length > 65000) throw new Error(tr('Photo trop volumineuse après optimisation.')); onChange({ ...value, [field]: photo }); }).catch(error => onError(error.message)).finally(() => onPhotoBusy(false));
        }} />
      </label>
      {value[field] && <><img src={value[field]} alt={tr(field === 'doorPhoto' ? 'Porte de la chambre' : 'Intérieur de la chambre')} className="aspect-[4/3] w-full rounded-xl object-cover" /><button type="button" onClick={() => onChange({ ...value, [field]: '' })} className="text-xs font-bold text-haven-red">{tr('Retirer la photo')}</button></>}
    </div>)}</div>
  </section>;
}
