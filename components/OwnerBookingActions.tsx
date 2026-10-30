import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { CalendarDays, Download, FileText, Home, Loader2, MessageCircle, MoreHorizontal, UserRound, X } from 'lucide-react';
import type { Booking, Listing, User } from '../types';
import { downloadPaymentReceipt } from './ReservationInformation';

export function OwnerBookingActions({ booking, listing, tenant, onCancel }: { booking: Booking; listing?: Listing; tenant: User; onCancel: () => void }) {
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const [details, setDetails] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const menuId = useId();
  const date = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const money = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
  const room = booking.roomName || listing?.rooms.find(item => item.id === booking.roomId)?.name || 'Chambre réservée';
  const status = booking.status === 'CANCELLED' ? 'Réservation annulée' : booking.status === 'COMPLETED' ? 'Séjour terminé' : 'Réservation confirmée';

  useEffect(() => {
    if (!menu) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const dismiss = () => setMenu(null);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMenu(null); trigger.current?.focus(); }
      if (event.key === 'Tab') setMenu(null);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || []);
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }
    };
    window.addEventListener('resize', dismiss); window.addEventListener('scroll', dismiss, true); document.addEventListener('keydown', keydown);
    return () => { window.removeEventListener('resize', dismiss); window.removeEventListener('scroll', dismiss, true); document.removeEventListener('keydown', keydown); };
  }, [menu]);
  useEffect(() => {
    if (!details) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; close.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setDetails(false); }
      if (event.key === 'Tab') {
        const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') || []);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); trigger.current?.focus(); };
  }, [details]);
  const itemClass = 'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-haven-navy hover:bg-gray-50 focus:bg-gray-50 focus:outline-none';
  const download = async () => {
    if (downloading) return;
    setDownloading(true); setError('');
    try { await downloadPaymentReceipt(booking.id); }
    catch (error) { setError(error instanceof Error ? error.message : 'Téléchargement indisponible.'); }
    finally { setDownloading(false); }
  };
  return <>
    <button ref={trigger} type="button" aria-label={`Actions pour la réservation ${room}`} aria-haspopup="menu" aria-expanded={Boolean(menu)} aria-controls={menu ? menuId : undefined} onClick={() => {
      if (menu) { setMenu(null); return; }
      const rect = trigger.current!.getBoundingClientRect();
      const height = booking.status === 'CONFIRMED' ? 260 : 214;
      setMenu({ left: Math.max(12, Math.min(rect.right - 250, window.innerWidth - 262)), top: Math.max(12, rect.bottom + height < window.innerHeight ? rect.bottom + 8 : rect.top - height) });
    }} className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-gray-500 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-haven-navy"><MoreHorizontal size={16} /></button>
    {menu && createPortal(<>
      <div className="fixed inset-0 z-[85]" onClick={() => { setMenu(null); trigger.current?.focus(); }} />
      <div ref={menuRef} id={menuId} role="menu" aria-label="Actions de réservation" style={menu} className="fixed z-[86] w-[250px] rounded-2xl border border-gray-100 bg-white p-2 shadow-xl">
        <button role="menuitem" type="button" className={itemClass} onClick={() => { setMenu(null); setError(''); setDetails(true); }}><FileText size={17} />Détails de la réservation</button>
        <Link role="menuitem" className={itemClass} to={`/messages/${booking.id}`} onClick={() => setMenu(null)}><MessageCircle size={17} />Contacter le locataire</Link>
        <Link role="menuitem" className={itemClass} to={`/profile/${booking.tenantId}`} onClick={() => setMenu(null)}><UserRound size={17} />Voir le profil du locataire</Link>
        <Link role="menuitem" className={itemClass} to={`/listing/${booking.listingId}`} onClick={() => setMenu(null)}><Home size={17} />Voir le logement</Link>
        {booking.status === 'CONFIRMED' && <button role="menuitem" type="button" className={`${itemClass} text-haven-red`} onClick={() => { setMenu(null); onCancel(); }}><X size={17} />Annuler le séjour</button>}
      </div>
    </>, document.body)}
    {details && createPortal(<div className="fixed inset-0 z-[90] flex items-center justify-center bg-haven-navy/50 p-3 backdrop-blur-sm sm:p-6" onClick={event => { if (event.target === event.currentTarget) setDetails(false); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className="haven-dialog-panel flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-gray-100 p-5"><h2 id={titleId} className="text-xl font-bold text-haven-navy">Détails de la réservation</h2><button ref={close} type="button" aria-label="Fermer les détails" onClick={() => setDetails(false)} className="rounded-full bg-gray-100 p-3"><X size={20} /></button></header>
        <div className="haven-dialog-scroll space-y-5 overflow-y-auto p-5 sm:p-7 text-left text-haven-navy">
          <div><p className="text-xs font-bold text-haven-red">{status}{booking.paymentIsTest ? ' · Simulation' : ''}</p><h3 className="mt-2 text-2xl font-bold">{listing?.title || booking.listingTitle || 'Logement'}</h3><p className="mt-1 text-gray-500">{room}</p></div>
          <div className="rounded-2xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Locataire</p><Link to={`/profile/${booking.tenantId}`} className="mt-1 inline-block font-bold underline underline-offset-4">{tenant.firstName}</Link></div>
          <div className="grid gap-3 sm:grid-cols-2">{[{ label: 'Arrivée', date: booking.startDate, time: `À partir de ${booking.checkInTime || listing?.checkInTime || '15:00'}` }, { label: 'Départ', date: booking.endDate, time: `Avant ${booking.checkOutTime || listing?.checkOutTime || '11:00'}` }].map(item => <div key={item.label} className="rounded-2xl bg-gray-50 p-4"><p className="flex items-center gap-2 text-xs text-gray-500"><CalendarDays size={15} />{item.label}</p><p className="mt-2 font-bold">{date(item.date)}</p><p className="mt-1 text-sm text-gray-500">{item.time}</p></div>)}</div>
          <dl className="space-y-3 rounded-2xl border border-gray-200 p-4 text-sm">{[['Séjour', booking.basePrice], ['Forfait ménage', booking.cleaningFee], ['Frais Haven', booking.platformFee], ['Total du séjour', booking.totalPrice]].map(([label, amount]) => <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-bold">{money(Number(amount))}</dd></div>)}</dl>
          <p className="break-all text-xs text-gray-500">Référence : {booking.id}</p>
          {booking.paymentIsTest && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Réservation de test : aucun débit bancaire.</p>}
          <div className="flex flex-wrap gap-3"><Link to={`/messages/${booking.id}`} className="rounded-xl bg-haven-navy px-4 py-3 text-sm font-bold text-white">Contacter le locataire</Link><button type="button" disabled={downloading} onClick={() => void download()} className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold disabled:opacity-50">{downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}Justificatif de paiement</button></div>
          {error && <p role="alert" className="text-sm text-haven-red">{error}</p>}
        </div>
      </div>
    </div>, document.body)}
  </>;
}
