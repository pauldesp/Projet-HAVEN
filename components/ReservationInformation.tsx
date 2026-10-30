import { stayLocalDate } from '../services/inventoryTiming';
import { ReservationHousemates } from './ReservationHousemates';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, FileText, Loader2, X } from 'lucide-react';
import { ReservationInformationView, type ReservationInformationData } from './ReservationInformationView';
import { authenticatedFetch } from '../services/serverApi';

export async function downloadPaymentReceipt(bookingId: string) {
  const response = await authenticatedFetch(`/api/bookings/${encodeURIComponent(bookingId)}/confirmation?format=pdf`);
  if (!response.ok) throw new Error('Impossible de télécharger le justificatif.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a'); link.href = url; link.download = `Haven-justificatif-${bookingId}.pdf`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export function ReservationInformation({ bookingId }: { bookingId: string }) {
  const [data, setData] = useState<ReservationInformationData | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    let active = true;
    setData(null); setError('');
    const load = async () => {
      try {
        const response = await authenticatedFetch(`/api/bookings/${encodeURIComponent(bookingId)}/confirmation`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (active) { setData(result); setError(''); }
      } catch (error) { if (active) setError(error instanceof Error ? error.message : 'Informations indisponibles.'); }
    };
    void load();
    const timer = setInterval(load, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [bookingId]);
  const download = async () => {
    if (downloading) return;
    setDownloading(true); setError('');
    try { await downloadPaymentReceipt(bookingId); }
    catch (error) { setError(error instanceof Error ? error.message : 'Téléchargement indisponible.'); }
    finally { setDownloading(false); }
  };
  if (!data) return <div role="status" className="flex min-h-48 items-center justify-center gap-3 p-6 text-center text-sm text-haven-stone">{!error && <Loader2 size={20} className="animate-spin" />}{error || 'Chargement des informations du séjour…'}</div>;
  return <ReservationInformationView data={data} error={error} downloading={downloading} onDownload={() => void download()}>{data.bookingStatus === 'CONFIRMED' && data.endDate.slice(0, 10) >= stayLocalDate(new Date(), data.timeZone || 'Europe/Paris') && <ReservationHousemates bookingId={bookingId} />}</ReservationInformationView>;
}

export function ReservationInformationDisclosure({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key === 'Tab') {
        const elements = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], summary, [tabindex="0"]') || []);
        const first = elements[0], last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); previousFocus?.focus(); };
  }, [open]);
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-gray-200 px-4 py-3 text-left text-sm font-bold text-haven-navy transition-colors hover:bg-gray-50">
      <span className="flex items-center gap-2"><FileText size={18} className="shrink-0" />Informations de ma réservation</span><ChevronRight size={17} className="shrink-0" />
    </button>
    {open && createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center bg-haven-navy/50 p-3 backdrop-blur-sm sm:p-6" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className="haven-dialog-panel relative flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-7 sm:py-5">
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-haven-stone">Mon séjour Haven</p><h2 id={titleId} className="mt-1 text-xl font-bold text-haven-navy">Informations de ma réservation</h2></div>
          <button ref={closeButton} type="button" onClick={() => setOpen(false)} aria-label="Fermer les informations de réservation" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-haven-navy hover:bg-gray-200"><X size={22} /></button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-7"><ReservationInformation bookingId={bookingId} /></div>
      </div>
    </div>, document.body)}
  </>;
}
