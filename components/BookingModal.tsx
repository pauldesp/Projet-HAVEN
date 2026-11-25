import { useSheet } from './useSheet';
import { CleaningPolicyNotice } from './CleaningPolicyNotice';
import { CLEANING_POLICY_VERSION } from '../services/cleaningPolicy';
import { DAMAGE_DEPOSIT_CONSENT_TEXT, DAMAGE_DEPOSIT_POLICY } from '../services/damageDeposit';
import { residenceDeclarationRecord, residenceDeclarationText, residenceDeclarationVersion } from '../services/residenceDeclaration';
import { OccupantForm, emptyOccupantDraft, occupantDraftProblem, occupantPayload, type OccupantDraft } from './OccupantForm';
import { isRoomAvailableForStay } from '../services/availability';
import { countNights, isBookableStay, localDateKey } from '../services/stay';
import { createRandomId } from '../services/randomId';
import { isRoomBookableForStay } from '../services/gapStay';
import { AUTO_CHARGE_CONSENT_VERSION, installmentDueDates } from '../services/recurringInstallments';

import React, { useState, useRef, useEffect } from 'react';
import { Room, Listing, Booking, LegalDocument } from '../types';
import { Button } from './Button';
import { X, Shield, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { userFacingErrorMessage } from '../services/errorHandling';
import { readableLegalHtml } from '../services/legalContent';

const bookingErrorMessage = (error: unknown) => {
  if (error instanceof Error && /\(Erreur (?:401|403|404|409|422|429|500|503)\)$/.test(error.message)) {
    return error.message.replace(/\s*\(Erreur \d+\)$/, '');
  }
  return userFacingErrorMessage(error);
};

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: Listing;
  room: Room;
  startDate: string;
  endDate: string;
  /** Recurring search: every stay is reserved now, the first one is paid now. */
  series?: { room: Room; startDate: string; endDate: string }[];
}

const stayPrice = (room: Room, listing: Listing, startDate: string, endDate: string) => {
  const base = room.pricePerDay * countNights(startDate, endDate);
  return base + (listing.cleaningFee || 0) + Math.round(base * 0.15);
};

export const BookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose, listing, room, startDate, endDate, series }) => {
  const isSeries = Boolean(series && series.length > 1);
  const stays = isSeries ? [...series!].sort((a, b) => a.startDate.localeCompare(b.startDate)) : [{ room, startDate, endDate }];
  const seriesKey = stays.map(stay => `${stay.room.id}:${stay.startDate}:${stay.endDate}`).join('|');
  const staysAvailable = (items: Parameters<typeof isRoomAvailableForStay>[2]) => stays.every(stay => isRoomBookableForStay(stay.room, listing, items, stay.startDate, stay.endDate));
  const unavailableMessage = isSeries ? 'Un de vos séjours vient d’être réservé. Relancez la recherche pour mettre à jour la série.' : 'Cette chambre est indisponible aux dates sélectionnées. Choisissez une autre chambre ou une autre période.';
  const [roomAvailable, setRoomAvailable] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(true);
  const [availabilityError, setAvailabilityError] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    setCheckingAvailability(true); setRoomAvailable(false); setAvailabilityError('');
    return apiService.availability.listenByListingId(listing.id, items => {
      const available = staysAvailable(items);
      setRoomAvailable(available); setCheckingAvailability(false);
      setAvailabilityError(available ? '' : unavailableMessage);
    }, error => { setCheckingAvailability(false); setRoomAvailable(false); setAvailabilityError(error.message); });
  }, [isOpen, listing, room, startDate, endDate, seriesKey]);
  const checkAvailability = async () => {
    setCheckingAvailability(true);
    try {
      const items = await apiService.availability.getByListingId(listing.id);
      const available = staysAvailable(items);
      setRoomAvailable(available);
      setAvailabilityError(available ? '' : unavailableMessage);
      return available;
    } catch (error) { setRoomAvailable(false); setAvailabilityError(error instanceof Error ? error.message : 'Disponibilité impossible à vérifier.'); return false; }
    finally { setCheckingAvailability(false); }
  };
  const [cleaningAccepted, setCleaningAccepted] = useState(false);
  const [depositAccepted, setDepositAccepted] = useState(false);
  // Unchecked by default: an explicit declaration at every booking.
  const [residenceDeclared, setResidenceDeclared] = useState(false);
  const [occupant, setOccupant] = useState<OccupantDraft>(emptyOccupantDraft);
  const firstArrival = stays[0]?.startDate || startDate;
  const occupantProblem = occupantDraftProblem(occupant, firstArrival);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Legal states
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocument | null>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const [isLoadingLegal, setIsLoadingLegal] = useState(false);

  const { currentUser } = useAuth();
  const sheet = useSheet(onClose);

  useEffect(() => {
    if (!isOpen) return;
    setCleaningAccepted(false);
    setDepositAccepted(false);
    setError(null);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);


  const loadLegalDoc = async () => {
    setIsLoadingLegal(true);
    try {
      const docs = await apiService.settings.getAllLegalDocuments();
      // On cherche d'abord le document spécifique aux réservations par son titre ou son ID
      const bookingTerms = docs.find(d =>
        d.id === 'conditions-generales-de-reservations' ||
        d.title.toLowerCase().includes('réservation') ||
        d.id === 'booking-terms'
      );

      const terms = bookingTerms || docs.find(d => d.id === 'terms') || {
        id: 'terms',
        title: 'Conditions générales de réservation',
        content: '# Conditions générales de réservation\n\nBienvenue sur HAVEN. En réservant ce logement, vous acceptez les conditions suivantes...',
        lastUpdated: new Date().toISOString()
      };
      setLegalDoc(terms);
    } catch (err) {
      console.error("Error loading legal docs", err);
    } finally {
      setIsLoadingLegal(false);
    }
  };

  const handleOpenLegal = async () => {
    setIsLoadingLegal(true);
    await loadLegalDoc();
    setIsLegalModalOpen(true);
  };

  if (!isOpen) return null;

  const nights = countNights(startDate, endDate);

  const basePrice = room.pricePerDay * nights;
  const cleaningFee = listing.cleaningFee || 0;
  const platformFee = Math.round(basePrice * 0.15);
  const total = basePrice + cleaningFee + platformFee;
  const today = localDateKey(new Date());
  const dueDates = installmentDueDates(stays, today);
  const seriesEntries = stays.map((stay, index) => ({ ...stay, index, amount: stayPrice(stay.room, listing, stay.startDate, stay.endDate), dueDate: dueDates[index] }));
  const seriesTotal = seriesEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const firstAmount = seriesEntries[0].amount;
  const dueSoon = seriesEntries.filter(entry => entry.index > 0 && entry.dueDate === today).reduce((sum, entry) => sum + entry.amount, 0);
  const money = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value);
  const shortDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  const handlePayment = async () => {
    if (!cleaningAccepted) { setError('Confirmez les engagements de ménage avant de continuer.'); return; }
    if (!depositAccepted) { setError('Acceptez la caution avant de continuer.'); return; }
    if (!residenceDeclared) { setError('Cochez la déclaration de résidence principale pour réserver.'); return; }
    if (occupantProblem) { setError(occupantProblem); return; }
    if (!await checkAvailability()) return;
    if (!currentUser) {
      setError("Vous devez être connecté pour réserver.");
      return;
    }
    if (isSeries) {
      setIsProcessing(true); setError(null);
      try {
        const result = await apiService.bookings.createSeries({
          seriesId: `s-${createRandomId()}`, listingId: listing.id, cleaningPolicyVersion: CLEANING_POLICY_VERSION, autoChargeConsentVersion: AUTO_CHARGE_CONSENT_VERSION, depositPolicyVersion: DAMAGE_DEPOSIT_POLICY.version, residenceDeclarationVersion: residenceDeclarationVersion(occupant.forSomeoneElse), ...occupantPayload(occupant, firstArrival),
          stays: stays.map(stay => ({ id: `b-${createRandomId()}`, roomId: stay.room.id, startDate: stay.startDate, endDate: stay.endDate })),
        });
        const first = [...result.bookings].sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
        window.location.hash = `#/payment/${encodeURIComponent(first.id)}`;
        onClose();
      } catch (e: unknown) {
        setError(bookingErrorMessage(e));
      } finally { setIsProcessing(false); }
      return;
    }
    if (!isBookableStay(startDate, endDate)) { setError('La date d’arrivée doit être aujourd’hui ou ultérieure.'); return; }
    if (nights < 1) { setError("Dates de séjour invalides."); return; }

    setIsProcessing(true);
    setError(null);
    let createdBookingId: string | null = null;

    try {
      // 1. Create a PENDING booking in Firestore first to "lock" the dates
      const bookingId = `b-${createRandomId()}`;
      const bookingData: Booking = {
        id: bookingId,
        listingId: listing.id,
        roomId: room.id,
        tenantId: currentUser.id,
        ownerId: listing.ownerId,
        startDate,
        endDate,
        status: 'PENDING',
        basePrice,
        cleaningFee,
        platformFee,
        totalPrice: total,
        createdAt: new Date().toISOString(),
        cleaningPolicyVersion: CLEANING_POLICY_VERSION,
        depositConsent: { version: DAMAGE_DEPOSIT_POLICY.version, text: DAMAGE_DEPOSIT_CONSENT_TEXT, amountCents: DAMAGE_DEPOSIT_POLICY.amountCents, acceptedAt: new Date().toISOString() },
        residenceDeclaration: residenceDeclarationRecord(new Date().toISOString(), occupant.forSomeoneElse),
        paymentStatus: 'PENDING'
      };

      await apiService.bookings.create(bookingData, occupantPayload(occupant, firstArrival));
      createdBookingId = bookingId;

      window.location.hash = `#/payment/${encodeURIComponent(bookingId)}`;
      onClose();
    } catch (e: unknown) {
      console.error("Erreur de réservation/paiement", e);
      // A checkout session that could not be opened must not keep the room blocked.
      // The cancellation is deliberately best-effort: the original error remains the
      // message shown to the tenant if the network is unavailable.
      if (createdBookingId) {
        try {
          await apiService.bookings.cancel(createdBookingId, 'Échec de la finalisation du paiement');
        } catch (cleanupError) {
          console.error('Impossible de libérer la réservation après un échec de paiement', cleanupError);
        }
      }
      setError(bookingErrorMessage(e));
    } finally {
      setIsProcessing(false);
    }
  };

  // One screen, like the big booking sites: the essentials in a few lines, the full terms one tap away,
  // and the payment button itself records the agreement (versions and texts are kept with the booking).
  const payAmount = isSeries ? firstAmount : total;
  const confirmBlock = <div className="space-y-4">
    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 text-sm text-gray-700">
      <li className="p-3"><span className="font-semibold text-haven-ink">Annulation</span> · remboursement intégral plus de 14 jours avant l’arrivée ; de 14 à 8 jours, 50 % de l’hébergement et du ménage (frais de service conservés) ; rien à moins de 8 jours.</li>
      {isSeries && <li className="p-3"><span className="font-semibold text-haven-ink">Séjours suivants</span> · prélevés automatiquement un mois avant chaque arrivée, avec un rappel par e-mail.</li>}
    </ul>
    <button type="button" onClick={() => void handleOpenLegal()} disabled={isLoadingLegal} className="text-sm font-semibold text-haven-ink underline underline-offset-4">Consulter les conditions complètes</button>
    {/* Cleaning and deposit stay explicit commitments, each with its own box. */}
    <CleaningPolicyNotice />
    <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4 text-sm leading-relaxed text-gray-700"><input type="checkbox" checked={cleaningAccepted} onChange={event => setCleaningAccepted(event.target.checked)} className="mt-1" />Je comprends que le forfait finance le ménage hebdomadaire organisé par le propriétaire et que je dois nettoyer et ranger avant mon départ.</label>
    <div className="rounded-xl border border-gray-200 p-4 text-sm leading-relaxed text-gray-700">
      <p className="font-bold text-haven-ink">Caution de {DAMAGE_DEPOSIT_POLICY.amountCents / 100} € · rien n’est débité</p>
      <p className="mt-1 text-gray-600">Votre carte est conservée de façon sécurisée par Stripe. Elle n’est prélevée que si le propriétaire déclare une dégradation dans les {DAMAGE_DEPOSIT_POLICY.claimWindowDays} jours suivant votre départ et que Haven la valide, après avoir lu votre réponse.</p>
      <label className="mt-3 flex items-start gap-3"><input type="checkbox" checked={depositAccepted} onChange={event => setDepositAccepted(event.target.checked)} className="mt-1" />{DAMAGE_DEPOSIT_CONSENT_TEXT}</label>
    </div>
    <OccupantForm value={occupant} onChange={next => { if (next.forSomeoneElse !== occupant.forSomeoneElse) setResidenceDeclared(false); setOccupant(next); }} arrival={firstArrival} />
    <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-4 text-sm leading-relaxed text-gray-700"><input type="checkbox" checked={residenceDeclared} onChange={event => setResidenceDeclared(event.target.checked)} className="mt-1" required />{residenceDeclarationText(occupant.forSomeoneElse)}</label>
    {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</p>}
    <Button fullWidth size="lg" disabled={isProcessing || checkingAvailability || !roomAvailable || !cleaningAccepted || !depositAccepted || !residenceDeclared || Boolean(occupantProblem)} onClick={() => void handlePayment()} className="py-4">
      {isProcessing ? 'Ouverture du paiement…' : checkingAvailability ? 'Vérification…' : !roomAvailable ? (isSeries ? 'Séjour indisponible' : 'Chambre indisponible') : `Confirmer et payer · ${money(payAmount)}`}
    </Button>
    <p className="text-center text-xs leading-relaxed text-gray-500">
      En sélectionnant ce bouton, j’accepte les <button type="button" onClick={() => void handleOpenLegal()} className="inline !min-h-0 underline underline-offset-2">conditions de réservation</button>{isSeries ? ' et le prélèvement automatique des séjours suivants' : ''}.
      {isSeries ? ' Vos séjours sont confirmés après le paiement du premier.' : ' Votre réservation est confirmée après le paiement.'}
    </p>
  </div>;

  return (
    <>
      <div role="dialog" aria-modal="true" aria-label="Réserver ce logement" className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-4">
        <div ref={sheet.backdropRef} className="haven-backdrop absolute inset-0 bg-haven-navy/40 backdrop-blur-sm" onClick={sheet.requestClose}></div>

        <div ref={sheet.panelRef} className="haven-sheet haven-dialog-panel relative bg-white rounded-t-[2rem] md:rounded-3xl w-full max-w-2xl max-h-[92dvh] md:max-h-[90dvh] overflow-y-auto shadow-2xl flex flex-col">
          {/* Handle and header: drag down to close on phones. */}
          <div {...sheet.dragProps} className="sticky top-0 z-10 bg-white">
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-200 md:hidden" />
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-4 md:p-6 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-normal text-lg md:text-xl text-haven-ink">Confirmer et payer</h2>
            </div>
            <button onClick={sheet.requestClose} aria-label="Fermer la réservation" className="haven-touch-action p-2 hover:bg-gray-100 rounded-full text-gray-500">
              <X size={20} />
            </button>
          </div>
          </div>

          <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-8">
            {availabilityError && <p role="alert" className="mb-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{availabilityError}</p>}
            {/* STEP 1: RECAP */}
            {isSeries && (
              <div className="space-y-5">
                <div className="flex gap-4 rounded-xl border border-gray-100 bg-haven-cream p-4">
                  <img src={room.photoUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  <div>
                    <h3 className="font-bold text-haven-ink">{listing.title}</h3>
                    <p className="text-sm text-gray-600">{stays.length} séjours réservés en une fois</p>
                    <p className="mt-1 text-xs text-gray-500">Arrivée à partir de {listing.checkInTime || '15:00'} · départ avant {listing.checkOutTime || '11:00'}</p>
                  </div>
                </div>
                <ol className="divide-y divide-gray-100 rounded-xl border border-gray-100 text-sm">
                  {seriesEntries.map(entry => (
                    <li key={entry.startDate} className="flex items-start justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-haven-ink">Séjour {entry.index + 1} · {entry.room.name}</p>
                        <p className="text-xs text-gray-500">{shortDate(entry.startDate)} → {shortDate(entry.endDate)} · {countNights(entry.startDate, entry.endDate)} nuits</p>
                        <p className="mt-1 text-xs text-gray-600">{entry.index === 0 ? 'Payé maintenant' : entry.dueDate === today ? 'Prélevé juste après votre paiement' : `Prélevé automatiquement le ${shortDate(entry.dueDate)}`}</p>
                      </div>
                      <span className="shrink-0 font-semibold text-haven-ink">{money(entry.amount)}</span>
                    </li>
                  ))}
                </ol>
                <dl className="space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
                  <div className="flex justify-between gap-3 font-bold text-haven-ink"><dt>À payer maintenant</dt><dd>{money(firstAmount)}</dd></div>
                  {dueSoon > 0 && <div className="flex justify-between gap-3 text-gray-600"><dt>Prélevé juste après (arrivées à moins d’un mois)</dt><dd>{money(dueSoon)}</dd></div>}
                  <div className="flex justify-between gap-3 text-gray-600"><dt>Total de la série, prix fixés aujourd’hui</dt><dd>{money(seriesTotal)}</dd></div>
                </dl>
                <p className="text-xs leading-relaxed text-gray-500">Votre carte est enregistrée de façon sécurisée par Stripe au premier paiement. Chaque séjour suivant est prélevé un mois avant son arrivée, avec un rappel par e-mail 3 jours avant. En cas d’échec, vous avez 5 jours pour payer ; sans paiement, seul ce séjour est annulé.</p>
                {confirmBlock}
              </div>
            )}
            {!isSeries && (
              <div className="space-y-6">
                  <div className="flex gap-4 p-4 bg-haven-cream rounded-xl border border-gray-100">
                    <img src={room.photoUrl} alt="" className="w-20 h-20 object-cover rounded-lg" />
                    <div>
                      <h3 className="font-bold text-haven-ink">{listing.title}</h3>
                      <p className="text-sm text-gray-600">{room.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{nights} nuit(s) • 1 Locataire</p>
                      <p className="mt-2 text-xs font-semibold text-haven-ink">Arrivée à partir de {listing.checkInTime || '15:00'} · Départ avant {listing.checkOutTime || '11:00'}</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex justify-between"><span>{nights} {nights === 1 ? 'nuit' : 'nuits'} × {room.pricePerDay} €</span><span>{basePrice}€</span></div>
                  <div className="flex justify-between"><span>Forfait ménage (par location)</span><span>{cleaningFee}€</span></div>
                  <div className="flex justify-between"><span>Frais HAVEN (15%)</span><span>{platformFee}€</span></div>
                  <div className="flex justify-between font-bold text-haven-ink text-lg pt-2 border-t border-gray-100">
                    <span>Total à payer</span><span>{total}€</span>
                  </div>
                </div>

                {confirmBlock}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Full Legal Document Overlay (Pattern Login) */}
      {isLegalModalOpen && legalDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8">
          <div className="absolute inset-0 bg-haven-navy/80 backdrop-blur-md" onClick={() => setIsLegalModalOpen(false)} />
          <div className="relative bg-white w-full max-w-5xl h-[100dvh] md:h-[90dvh] md:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
            <div className="shrink-0 px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-haven-red/10 rounded-2xl flex items-center justify-center text-haven-red">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="font-heading font-normal text-lg sm:text-xl text-haven-ink leading-tight mb-1">{legalDoc.title}</h3>
                  <p className="text-[11px] font-bold text-gray-400">Document officiel HAVEN</p>
                </div>
              </div>
              <button onClick={() => setIsLegalModalOpen(false)} className="shrink-0 w-11 h-11 rounded-2xl hover:bg-gray-100 flex items-center justify-center text-haven-stone transition-all">
                <XCircle size={28} />
              </button>
            </div>

            <div ref={modalScrollRef} className="min-h-0 min-w-0 flex-grow overflow-y-auto overflow-x-hidden p-5 sm:p-8 md:p-16 bg-white scroll-smooth leading-relaxed">
              <div className="w-full min-w-0 max-w-3xl mx-auto">
                <div className="haven-booking-terms prose prose-sm sm:prose-base prose-slate max-w-none
                  prose-headings:font-heading prose-headings:text-haven-ink prose-headings:font-normal
                  prose-p:text-haven-stone sm:prose-p:text-lg prose-p:leading-relaxed prose-p:mb-3 sm:prose-p:mb-6
                  prose-li:text-haven-stone sm:prose-li:text-lg prose-li:mb-1 sm:prose-li:mb-2
                  prose-strong:text-haven-ink prose-strong:font-normal
                ">
                  <div
                    dangerouslySetInnerHTML={{ __html: readableLegalHtml(legalDoc.content) }}
                  />
                </div>
              </div>
            </div>

            <div className="haven-dialog-footer shrink-0 border-t border-gray-100 bg-gray-50/50 px-4 py-3 sm:px-8 sm:py-6">
              <Button fullWidth onClick={() => setIsLegalModalOpen(false)} className="font-bold">Fermer</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
