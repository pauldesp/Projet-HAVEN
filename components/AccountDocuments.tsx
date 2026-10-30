import { useLanguage } from '../contexts/LanguageContext';
import { authenticatedFetch } from '../services/serverApi';
import { useEffect, useState } from 'react';
import { FileText, ShieldCheck, X } from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useListings } from '../contexts/ListingContext';
import type { AppDocument, Booking } from '../types';
import { inventoryDocumentHtml } from '../services/inventoryDocument';
import { ReservationInformation, downloadPaymentReceipt } from './ReservationInformation';
import { toast } from 'sonner';

export function AccountDocuments({ onManageIdentity }: { onManageIdentity: () => void }) {
  const { tr, locale } = useLanguage();
  const { currentUser } = useAuth();
  const { listings } = useListings();
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AppDocument | null>(null);
  const [html, setHtml] = useState('');
  const [proofPreview, setProofPreview] = useState('');
  useEffect(() => {
    if (!currentUser) return;
    setDocuments([]); setBookings([]); setLoading(true);
    const unsubscribeDocs = apiService.documents.listenToByUserId(currentUser.id, docs => { setDocuments(docs); setLoading(false); });
    const unsubscribeBookings = apiService.bookings.listenByParticipant(currentUser.id, 'TENANT', setBookings, () => toast.error(tr("Impossible de charger les informations des séjours.")));
    return () => { unsubscribeDocs(); unsubscribeBookings(); };
  }, [currentUser?.id]);
  const reportHtml = async (doc: AppDocument) => {
    const report = await apiService.inventory.getById(doc.reportId!);
    if (!report) throw new Error(tr("Document introuvable."));
    const booking = bookings.find(item => item.id === report.bookingId) || await apiService.bookings.getById(report.bookingId);
    const listing = listings.find(item => item.id === booking?.listingId) || (booking ? await apiService.listings.getById(booking.listingId) : undefined);
    return inventoryDocumentHtml(report, doc.title, { booking, listing, tenant: currentUser || undefined });
  };
  useEffect(() => {
    let active = true; setHtml('');
    if (selected?.reportId) void reportHtml(selected).then(value => { if (active) setHtml(value); }).catch(() => { if (active) setHtml('<p>Impossible de charger cet état des lieux. Réessayez.</p>'); });
    return () => { active = false; };
  }, [selected, bookings, listings, currentUser]);
  const download = async (doc: AppDocument) => {
    try {
      if (doc.receiptId) { await downloadPaymentReceipt(doc.receiptId); return; }
      if (doc.reportId) {
        const url = URL.createObjectURL(new Blob([await reportHtml(doc)], { type: 'text/html;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = `${doc.title}.html`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000); return;
      }
      if (!doc.url) throw new Error(tr("Document indisponible."));
      const link = document.createElement('a'); link.href = doc.url; link.download = `${doc.title}.pdf`; link.target = '_blank'; link.rel = 'noopener noreferrer'; document.body.appendChild(link); link.click(); link.remove();
    } catch { toast.error(tr("Impossible de télécharger ce document.")); }
  };
  return <section id="documents" className="scroll-mt-24 rounded-3xl border border-gray-100 bg-white p-6 shadow-soft md:p-8">
    <h2 className="font-heading text-xl font-bold text-haven-navy">{tr("Mes documents")}</h2>
    <div className="mt-6 rounded-2xl border border-gray-100 p-5">
      <h3 className="flex items-center gap-2 font-bold text-haven-navy"><ShieldCheck size={20} />{tr("Pièce d’identité")}</h3>
      <p className="mt-2 text-sm text-gray-500">{currentUser?.documents?.idCard ? currentUser.identityVerified ? tr("Identité vérifiée") : tr("Document transmis") : tr("Aucun document transmis")}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {currentUser?.documents?.idCard && <button type="button" onClick={() => window.open(currentUser.documents!.idCard, '_blank', 'noopener,noreferrer')} className="rounded-xl border px-4 py-2 text-sm font-bold text-haven-navy">{tr("Voir")}</button>}
        <button type="button" onClick={onManageIdentity} className="rounded-xl border px-4 py-2 text-sm font-bold text-haven-navy">{currentUser?.documents?.idCard ? tr("Gérer mon justificatif") : tr("Ajouter ma pièce d’identité")}</button>
      </div>
    </div>
    <div className="mt-4 rounded-2xl border border-gray-100 p-5"><h3 className="font-bold text-haven-navy">{tr("Justificatif de domicile")}</h3><p className="mt-2 text-sm text-gray-500">{currentUser?.documents?.proofOfAddress ? currentUser.residenceVerified ? tr("Domicile vérifié") : tr("Document transmis, à examiner") : tr("À ajouter dans la rubrique Mon domicile")}</p>{currentUser?.documents?.proofOfAddress && <button type="button" onClick={() => { void authenticatedFetch(`/api/users/${currentUser.id}/proof-of-address`).then(async response => { if (!response.ok) throw new Error(); const data = await response.json(); setProofPreview(data.dataUrl); }).catch(() => toast.error(tr("Impossible de charger le justificatif."))); }} className="mt-3 rounded-xl border px-4 py-2 text-sm font-bold">{tr("Voir le justificatif")}</button>}</div>
    {proofPreview && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-haven-navy/70 p-4"><section role="dialog" aria-modal="true" aria-label={tr("Justificatif de domicile")} className="haven-dialog-panel w-full max-w-4xl rounded-3xl bg-white p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-bold">{tr("Justificatif de domicile")}</h3><button type="button" onClick={() => setProofPreview('')} aria-label={tr("Fermer le justificatif")}><X /></button></div><iframe title={tr("Justificatif de domicile")} src={proofPreview} sandbox="" className="h-[65vh] w-full border-0" /></section></div>}
    <h3 className="mt-8 flex items-center gap-2 font-bold text-haven-navy"><FileText size={20} />{tr("Documents de mes séjours")} {documents.length ? `(${documents.length})` : ''}</h3>
    {loading ? <p role="status" className="mt-4 text-sm text-gray-500">{tr("Chargement…")}</p> : !documents.length ? <p className="mt-4 text-sm text-gray-500">{tr("Aucun document de séjour pour le moment.")}</p> : <div className="mt-4 space-y-3">{documents.map(doc => <article key={doc.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-100 p-5 sm:flex-row sm:items-center">
      <div><h4 className="font-bold text-haven-navy">{doc.title}</h4><p className="mt-1 text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString(locale)}</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => setSelected(doc)} className="rounded-xl border px-4 py-2 text-sm font-bold text-haven-navy">{tr("Visualiser")}</button><button type="button" onClick={() => void download(doc)} className="rounded-xl bg-haven-navy px-4 py-2 text-sm font-bold text-white">{tr("Télécharger")}</button></div>
    </article>)}</div>}
    {selected && <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-haven-navy/70 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-label={selected.title} className="haven-dialog-panel flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
      <header className="flex items-center justify-between gap-4 border-b p-5"><h2 className="font-heading text-xl font-bold text-haven-navy">{selected.title}</h2><button type="button" aria-label={tr("Fermer le document")} onClick={() => setSelected(null)} className="rounded-full bg-gray-100 p-3"><X size={20} /></button></header>
      <div className="haven-dialog-scroll overflow-y-auto p-4 md:p-6">{selected.receiptId ? <ReservationInformation bookingId={selected.receiptId} /> : selected.reportId ? <iframe title={selected.title} srcDoc={html || '<p>Chargement…</p>'} sandbox="" className="h-[60vh] w-full border-0" /> : selected.url ? <iframe title={selected.title} src={selected.url} sandbox="" className="h-[60vh] w-full border-0" /> : <p>{tr("Ce document n’est pas disponible.")}</p>}</div>
      <footer className="haven-dialog-footer shrink-0 flex justify-end gap-3 border-t p-5"><button type="button" onClick={() => setSelected(null)} className="rounded-xl border px-4 py-2 font-bold">{tr("Fermer")}</button><button type="button" onClick={() => void download(selected)} className="rounded-xl bg-haven-navy px-4 py-2 font-bold text-white">{tr("Télécharger")}</button></footer>
    </section></div>}
  </section>;
}
