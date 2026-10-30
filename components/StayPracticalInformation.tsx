import { CarFront, Info, LockKeyhole, Wifi, Settings2, Recycle } from 'lucide-react';
import type { StayPracticalInfo } from '../services/stayGuide';
import { useLanguage } from '../contexts/LanguageContext';

export function StayPracticalInformation({ available, info }: { available: boolean; info?: StayPracticalInfo }) {
  const { tr } = useLanguage();
  const hasInfo = info && Object.values(info).some(Boolean);
  return <section className="rounded-2xl border border-gray-200 p-5">
    <h4 className="flex items-center gap-2 font-bold text-haven-navy"><Info size={19} />{tr('Bien préparer votre arrivée')}</h4>
    {!available ? <div className="mt-4 flex gap-3 rounded-xl bg-gray-50 p-4 text-sm leading-relaxed text-gray-600"><LockKeyhole size={18} className="mt-0.5 shrink-0" /><p>{tr('Les informations de stationnement, de Wi-Fi et les conseils pratiques seront disponibles ici 72 h avant votre arrivée, ou dès confirmation pour une réservation de dernière minute.')}</p></div> : !hasInfo ? <p className="mt-3 text-sm leading-relaxed text-gray-500">{tr('Le propriétaire n’a pas encore ajouté d’informations pratiques. Vous pouvez le contacter dans la messagerie du séjour.')}</p> : <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {info.parking && <div className="rounded-2xl bg-gray-50 p-4"><h5 className="flex items-center gap-2 text-sm font-bold"><CarFront size={18} />{tr('Stationnement')}</h5><p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-gray-600">{info.parking}</p></div>}
      {(info.wifiName || info.wifiPassword) && <div className="rounded-2xl bg-blue-50/60 p-4"><h5 className="flex items-center gap-2 text-sm font-bold"><Wifi size={18} />Wi-Fi</h5><dl className="mt-3 space-y-3 text-sm">{info.wifiName && <div><dt className="text-xs text-gray-500">{tr('Nom du réseau Wi-Fi')}</dt><dd className="mt-1 whitespace-pre-wrap break-all font-semibold">{info.wifiName}</dd></div>}{info.wifiPassword && <div><dt className="text-xs text-gray-500">{tr('Mot de passe Wi-Fi')}</dt><dd className="mt-1 whitespace-pre-wrap break-all font-mono">{info.wifiPassword}</dd></div>}</dl></div>}
      {([{ key: 'equipment', label: 'Équipements et fonctionnement', icon: Settings2 }, { key: 'weeklyCleaning', label: 'Organisation du ménage hebdomadaire', icon: Settings2 }, { key: 'waste', label: 'Tri et poubelles', icon: Recycle }, { key: 'usefulInfo', label: 'Autres informations utiles', icon: Info }] as const).map(({ key, label, icon: Icon }) => info[key] && <div key={key} className="rounded-2xl bg-gray-50 p-4 sm:col-span-2"><h5 className="flex items-center gap-2 text-sm font-bold"><Icon size={18} />{tr(label)}</h5><p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-gray-600">{info[key]}</p></div>)}
    </div>}
  </section>;
}
