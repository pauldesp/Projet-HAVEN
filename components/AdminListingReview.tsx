import React, { useState } from 'react';
import { XCircle, Home, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Listing } from '../types';
import { Button } from './Button';
import { getListingPhotoUrls } from '../services/media';

export function AdminListingReview({ listing, ownerName, processing, error, onClose, onApprove, onReject, onEdit }: {
  listing: Listing; ownerName: string; processing: boolean; error: string | null;
  onClose: () => void; onApprove: () => void; onReject: () => void; onEdit: () => void;
}) {
  const [reviewed, setReviewed] = useState(false);
  const photos = getListingPhotoUrls(listing);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-haven-navy/60 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="listing-review-title" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-gray-100 p-6">
          <div className="flex items-center gap-3"><Home className="text-haven-red"/><div><p className="text-xs font-bold uppercase tracking-widest text-gray-400">Examen de l’annonce</p><h2 id="listing-review-title" className="text-xl font-bold text-haven-navy">{listing.title}</h2></div></div>
          <button aria-label="Fermer la fiche" onClick={onClose} disabled={processing} className="p-2 text-gray-400"><XCircle/></button>
        </header>
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-5"><h3 className="font-bold text-haven-navy">Logement</h3><p>{listing.address}, {listing.city}</p><p className="mt-2 text-sm text-gray-500">{listing.type === 'HOUSE' ? 'Maison' : 'Appartement'} · {listing.surface} m² · {listing.totalRooms} chambres · {listing.bathrooms} salles de bain</p></div>
            <div className="rounded-2xl bg-gray-50 p-5"><h3 className="font-bold text-haven-navy">Propriétaire</h3><p>{ownerName}</p><p className="mt-2 text-sm text-gray-500">Arrivée dès {listing.checkInTime || '15:00'} · Départ avant {listing.checkOutTime || '11:00'}</p><p className="text-sm text-gray-500">Séjour minimum : {listing.minStay || 4} nuit(s) · Ménage : {listing.cleaningFee || 0} €</p></div>
          </div>
          <div><h3 className="mb-3 font-bold text-haven-navy">Description</h3><div className="prose prose-sm max-w-none text-gray-600"><ReactMarkdown>{listing.description || 'Description manquante.'}</ReactMarkdown></div></div>
          <div><h3 className="mb-3 font-bold text-haven-navy">Photos du logement</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((url, index) => <a key={index} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Logement, photo ${index + 1}`} className="h-40 w-full rounded-xl object-cover"/></a>)}</div></div>
          <div><h3 className="mb-3 font-bold text-haven-navy">Chambres</h3><div className="grid gap-4 sm:grid-cols-2">{(listing.rooms || []).map(room => <article key={room.id} className="overflow-hidden rounded-2xl border border-gray-100">
            {(room.roomPhotos?.[0] || room.photoUrl) && <img src={room.roomPhotos?.[0] || room.photoUrl} alt={room.name} className="h-48 w-full object-cover"/>}
            <div className="p-4"><h4 className="font-bold text-haven-navy">{room.name}</h4><p>{room.pricePerDay} € / nuit · {room.size} m² · Lit {room.bedSize}</p><p className="mt-2 text-sm text-gray-500">{[room.hasPrivateBath && 'Salle de bain privée', room.hasDesk && 'Bureau', room.hasLock && 'Verrou', room.hasWardrobe && 'Armoire'].filter(Boolean).join(' · ') || 'Aucune option renseignée'}</p></div>
          </article>)}</div></div>
          <div><h3 className="mb-2 font-bold text-haven-navy">Équipements</h3><p className="text-sm text-gray-600">{listing.amenities?.join(' · ') || 'Aucun équipement renseigné'}</p></div>
          {listing.rejectionReason && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Motif du refus : {listing.rejectionReason}</p>}
          {listing.status === 'DRAFT' ? <p className="rounded-xl bg-orange-50 p-4 text-orange-700">Cette annonce est encore à compléter. Le propriétaire doit la transmettre avant son examen.</p> : listing.status !== 'APPROVED' && <label className="flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-haven-navy"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} className="mt-1"/>J’ai contrôlé les informations du logement, les chambres et les photos de cette annonce.</label>}
        </div>
        <footer className="flex flex-wrap justify-end gap-3 border-t border-gray-100 bg-gray-50 p-5">
          <Button variant="outline" onClick={onEdit} disabled={processing}>Modifier</Button>
          {listing.status !== 'DRAFT' && listing.status !== 'REJECTED' && <Button variant="outline" onClick={onReject} disabled={processing}>Refuser l’annonce</Button>}
          {listing.status !== 'APPROVED' && <Button onClick={onApprove} disabled={processing || !reviewed || listing.status === 'DRAFT'} className="bg-green-600 text-white hover:bg-green-700">{processing && <Loader2 size={16} className="mr-2 animate-spin"/>}Valider l’annonce</Button>}
          <Button variant="outline" onClick={onClose} disabled={processing}>Fermer</Button>
        </footer>
      </section>
    </div>
  );
}
