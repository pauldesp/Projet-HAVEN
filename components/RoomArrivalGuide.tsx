import { DoorOpen, KeyRound } from 'lucide-react';
import type { RoomGuide } from '../services/roomGuide';
import { useLanguage } from '../contexts/LanguageContext';

export function RoomArrivalGuide({ available, guide, roomName }: { available: boolean; guide?: RoomGuide; roomName: string }) {
  const { tr } = useLanguage();
  if (!available || !guide || !Object.values(guide).some(Boolean)) return null;
  return <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
    <h4 className="flex items-center gap-2 font-bold"><DoorOpen size={19} />{tr('Reconnaître votre chambre')}</h4>
    <p className="mt-2 font-bold text-haven-red">{roomName}</p>
    {guide.location && <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-gray-600">{guide.location}</p>}
    {guide.keyLabel && <p className="mt-3 flex items-start gap-2 text-sm text-gray-600"><KeyRound size={17} className="mt-0.5 shrink-0" /><span className="whitespace-pre-line break-words">{guide.keyLabel}</span></p>}
    <div className="mt-4 grid gap-4 sm:grid-cols-2">{(['doorPhoto', 'interiorPhoto'] as const).map(field => guide[field] && <figure key={field}><img src={guide[field]} alt={tr(field === 'doorPhoto' ? 'Porte de la chambre' : 'Intérieur de la chambre')} className="max-h-96 w-full rounded-xl object-contain bg-white" /><figcaption className="mt-2 text-xs text-gray-500">{tr(field === 'doorPhoto' ? 'Porte de la chambre' : 'Intérieur de la chambre')}</figcaption></figure>)}</div>
  </section>;
}
