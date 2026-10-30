import { RoomArrivalGuide } from './RoomArrivalGuide';
import type { RoomGuide } from '../services/roomGuide';
import { CleaningPolicyNotice } from './CleaningPolicyNotice';
import { StayPracticalInformation } from './StayPracticalInformation';
import type { StayPracticalInfo } from '../services/stayGuide';
import React from 'react';
import { CalendarDays, ChevronDown, Download, FileCheck2, KeyRound, Loader2, MapPin, ShieldCheck } from 'lucide-react';
import type { ReservationConfirmation } from '../services/reservationFulfillment';

export type ReservationInformationData = ReservationConfirmation & {
  practicalInfo?: StayPracticalInfo; arrivalInformationAvailable?: boolean; roomGuide?: RoomGuide;
  instructions: string; emailStatus: string; emailConfigured: boolean; bookingStatus: string;
};
const dateLabel = (value: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));

export function ReservationInformationView({ data, error, downloading, onDownload, children }: {
  children?: React.ReactNode; data: ReservationInformationData; error: string; downloading: boolean; onDownload: () => void;
}) {
  const instructionsDue = Date.now() >= Date.parse(data.instructionsDueAt);
  return <div className="space-y-5 text-haven-navy">
    <div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {data.bookingStatus === 'CANCELLED' ? <span className="rounded-full bg-red-50 px-3 py-1 font-bold text-red-700">Réservation annulée</span> : <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">Réservation {data.bookingId.slice(-8)}</span>}
        {data.isTest && <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800">Test · aucun débit bancaire</span>}
      </div>
      <h3 className="mt-3 font-heading text-2xl font-bold leading-tight sm:text-3xl">{data.listingTitle}</h3>
      {data.roomName && <p className="mt-1 text-sm text-haven-stone">{data.roomName}</p>}
    </div>

    <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
      {[{ title: 'Arrivée', date: data.startDate, time: `À partir de ${data.checkInTime}` }, { title: 'Départ', date: data.endDate, time: `Avant ${data.checkOutTime}` }].map(item => <div key={item.title} className="rounded-2xl bg-gray-50 p-4 sm:p-5">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-haven-stone"><CalendarDays size={16} aria-hidden="true" />{item.title}</p>
        <p className="mt-2 text-base font-bold sm:text-lg">{dateLabel(item.date)}</p>
        <p className="mt-1 text-sm text-gray-600">{item.time}</p>
      </div>)}
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-gray-200 p-5">
        <h4 className="flex items-center gap-2 font-bold"><MapPin size={19} className="text-haven-red" aria-hidden="true" />Adresse du logement</h4>
        <p className="mt-3 text-sm leading-relaxed break-words">{data.address || 'Le propriétaire doit encore préciser l’adresse.'}</p>
      </section>
      {data.bookingStatus === 'CONFIRMED' && <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
        <h4 className="flex items-center gap-2 font-bold"><KeyRound size={19} aria-hidden="true" />Accès et remise des clés</h4>
        {data.instructions ? <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed">{data.instructions}</p> : <p className="mt-3 text-sm leading-relaxed text-gray-600">{instructionsDue ? 'Les consignes d’entrée sont en attente du propriétaire. Contactez-le depuis la messagerie de votre séjour.' : 'Vos consignes seront disponibles ici et envoyées par e-mail 72 h avant votre arrivée. Pour une réservation de dernière minute, l’envoi est prévu dès confirmation.'}</p>}
      </section>}
    </div>

    {data.bookingStatus === 'CONFIRMED' && <RoomArrivalGuide available={data.arrivalInformationAvailable === true} guide={data.roomGuide} roomName={data.roomName} />}

    {data.bookingStatus === 'CONFIRMED' && <StayPracticalInformation available={data.arrivalInformationAvailable === true} info={data.practicalInfo} />}

    <CleaningPolicyNotice />

    {children}

    <details className="group rounded-2xl border border-gray-200">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-bold [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2"><ShieldCheck size={19} aria-hidden="true" />Règles communes Haven</span><ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="space-y-3 border-t border-gray-100 px-5 py-4 text-sm leading-relaxed text-gray-600">{data.rules.map((rule, index) => <li key={rule} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-haven-navy">{index + 1}</span><span>{rule}</span></li>)}</ul>
    </details>

    <section className="rounded-2xl bg-haven-navy p-5 text-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3"><FileCheck2 size={22} className="mt-0.5 shrink-0" aria-hidden="true" /><div><h4 className="font-bold">Votre justificatif {data.isTest ? 'de simulation' : 'de paiement'}</h4><p className="mt-1 text-sm text-white/70">{(data.amountCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} · Document PDF</p></div></div>
        <button type="button" disabled={downloading} onClick={onDownload} className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-haven-navy hover:bg-gray-100 disabled:opacity-60">
          {downloading ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />} {downloading ? 'Téléchargement…' : 'Télécharger'}
        </button>
      </div>
    </section>
    <p className="text-xs text-haven-stone">{data.emailStatus === 'SENT' ? 'E-mail de confirmation envoyé.' : 'E-mail de confirmation en attente d’envoi.'}</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div>;
}
