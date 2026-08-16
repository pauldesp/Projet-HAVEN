import React, { useState, useRef, useEffect } from 'react';
import { Room, Listing, Booking, LegalDocument } from '../types';
import { Button } from './Button';
import { X, Check, FileText, CreditCard, User, ShieldCheck, Shield, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: Listing;
  room: Room;
  startDate: string;
  endDate: string;
}

export const BookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose, listing, room, startDate, endDate }) => {
  const [step, setStep] = useState(1);
  const [isSigned, setIsSigned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Legal states
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocument | null>(null);
  const [legalScrolled, setLegalScrolled] = useState(false);
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const [isLoadingLegal, setIsLoadingLegal] = useState(false);

  const { currentUser } = useAuth();

  useEffect(() => {
    if (step === 2 && !legalDoc) {
      loadLegalDoc();
    }
  }, [step]);

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
        title: 'Conditions Générales de Réservation',
        content: '# Conditions Générales de Réservation\n\nBienvenue sur HAVEN. En réservant ce logement, vous acceptez les conditions suivantes...',
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
    setLegalScrolled(false);
  };

  const handleLegalScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      setLegalScrolled(true);
    }
  };

  if (!isOpen) return null;

  // Calcul du nombre de jours
  const days = startDate && endDate 
    ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))) 
    : 1;

  const basePrice = room.pricePerDay * days;
  const cleaningFee = listing.cleaningFee || 0;
  const platformFee = Math.round(basePrice * 0.15);
  const total = basePrice + cleaningFee + platformFee;

  const handleNext = () => {
    setError(null);
    setStep(s => s + 1);
  };
  
  const handlePayment = async () => {
    if (!currentUser) {
      setError("Vous devez être connecté pour réserver.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // 1. Create a PENDING booking in Firestore first to "lock" the dates
      const bookingId = `b-${crypto.randomUUID()}`;
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
        paymentStatus: 'PENDING'
      };

      await apiService.bookings.create(bookingData);
      
      // 2. Call our server to create a Stripe checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          listingId: listing.id,
          amount: total,
          listingTitle: listing.title,
          roomName: room.name,
          successUrl: `${window.location.origin}${window.location.pathname}?booking=success&id=${bookingId}#/dashboard`,
          cancelUrl: `${window.location.origin}${window.location.pathname}?booking=cancel&id=${bookingId}`,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erreur Stripe");
      }

      const session = await response.json();
      
      // 3. Redirect to Stripe Checkout
      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error("URL de session non reçue");
      }
    } catch (e: any) {
      console.error("Erreur de réservation/paiement", e);
      setError(e.message || "Une erreur est survenue lors de l'initialisation du paiement.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-haven-navy/40 backdrop-blur-sm" onClick={onClose}></div>
        
        <div className="relative bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
            <h2 className="font-heading font-bold text-xl text-haven-navy">
              {step === 5 ? 'Réservation confirmée !' : 'Demande de réservation'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
              <X size={20} />
            </button>
          </div>

          {/* Progress Bar */}
          {step < 5 && (
            <div className="w-full bg-gray-100 h-1.5">
              <div 
                className="bg-haven-red h-1.5 transition-all duration-500 ease-out" 
                style={{ width: `${(step / 3) * 100}%` }}
              ></div>
            </div>
          )}

          <div className="p-8">
            {/* STEP 1: RECAP */}
            {step === 1 && (
              <div className="space-y-6">
                  <div className="flex gap-4 p-4 bg-haven-cream rounded-xl border border-gray-100">
                    <img src={room.photoUrl} alt="" className="w-20 h-20 object-cover rounded-lg" />
                    <div>
                      <h3 className="font-bold text-haven-navy">{listing.title}</h3>
                      <p className="text-sm text-gray-600">{room.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{days} Jour(s) • 1 Locataire</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex justify-between"><span>Loyer ({days} jour(s))</span><span>{basePrice}€</span></div>
                  <div className="flex justify-between"><span>Ménage (par location)</span><span>{cleaningFee}€</span></div>
                  <div className="flex justify-between"><span>Frais HAVEN (15%)</span><span>{platformFee}€</span></div>
                  <div className="flex justify-between font-bold text-haven-navy text-lg pt-2 border-t border-gray-100">
                    <span>Total à payer</span><span>{total}€</span>
                  </div>
                </div>
                
                <Button fullWidth onClick={handleNext}>Valider et continuer</Button>
              </div>
            )}

            {/* STEP 2: LEGAL & CONDITIONS - Pattern Login */}
            {step === 2 && (
              <div className="space-y-8 py-4">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-haven-red/10 rounded-2xl flex items-center justify-center text-haven-red mx-auto">
                    <Shield size={32} />
                  </div>
                  <h3 className="text-xl font-heading font-bold text-haven-navy">Conditions générales & Accord Tripartite</h3>
                  <p className="text-sm text-haven-stone">Veuillez lire et accepter les Conditions Générales de Réservations. Votre validation et votre paiement vaudront signature de l'accord tripartite (Locataire, Propriétaire, HAVEN) valant contrat officiel.</p>
                </div>

                <div className={`p-6 rounded-[2rem] border transition-all ${isSigned ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 shadow-premium'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <FileText className="text-haven-red" size={24} />
                      <span className="font-bold text-haven-navy">
                        {legalDoc ? legalDoc.title : "Conditions Générales"}
                      </span>
                    </div>
                    {isSigned && <CheckCircle className="text-green-600" size={24} />}
                  </div>
                  <Button 
                    fullWidth 
                    variant={isSigned ? "outline" : "primary"} 
                    onClick={handleOpenLegal}
                    className="rounded-xl"
                    disabled={isLoadingLegal}
                  >
                    {isSigned ? "Relire le document" : "Lire et valider"}
                  </Button>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
                    {error}
                  </div>
                )}

                {listing.bookingMode === 'MANUAL' ? (
                  <Button 
                    fullWidth 
                    size="lg" 
                    disabled={!isSigned || isProcessing}
                    onClick={async () => {
                      if (!currentUser) return;
                      setIsProcessing(true);
                      setError(null);
                      try {
                        const bookingId = `b-${crypto.randomUUID()}`;
                        const bookingData: Booking = {
                          id: bookingId,
                          listingId: listing.id,
                          roomId: room.id,
                          roomName: room.name || 'Chambre',
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
                          paymentStatus: 'PENDING',
                          bookingMode: 'MANUAL'
                        };
                        await apiService.bookings.create(bookingData);

                        // Fetch owner user profile and send notification email (Chantier 3)
                        try {
                          const ownerProfile = await apiService.users.getById(listing.ownerId);
                          if (ownerProfile && ownerProfile.email) {
                            await apiService.notifications.sendBookingNotification(
                              ownerProfile.email,
                              'REQUEST_SUBMITTED',
                              {
                                listingTitle: listing.title,
                                roomName: room.name || 'Chambre',
                                amount: total,
                                startDate: new Date(startDate).toLocaleDateString('fr-FR'),
                                endDate: new Date(endDate).toLocaleDateString('fr-FR'),
                                tenantName: `${currentUser.firstName} ${currentUser.lastName}`,
                                ownerName: `${ownerProfile.firstName} ${ownerProfile.lastName}`,
                                bookingId
                              }
                            );
                          }
                        } catch (emailErr) {
                          console.error("Failed to notify owner via email:", emailErr);
                        }

                        setStep(5);
                      } catch (err: any) {
                        setError(err.message || "Erreur lors de la soumission de votre demande.");
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    className="py-4 shadow-xl shadow-haven-red/10"
                  >
                    {isProcessing ? 'Envoi...' : "Envoyer ma demande de réservation"}
                  </Button>
                ) : (
                  <Button 
                    fullWidth 
                    size="lg" 
                    disabled={!isSigned}
                    onClick={handleNext}
                    className="py-4 shadow-xl shadow-haven-red/10"
                  >
                    Continuer vers le paiement
                  </Button>
                )}
              </div>
            )}

            {/* STEP 3: PAYMENT & STRIPE REDIRECT */}
            {step === 3 && (
              <div className="space-y-6">
                <h3 className="font-heading font-bold text-lg">Paiement sécurisé</h3>
                
                <div className="bg-white border-2 border-haven-navy group p-6 rounded-2xl flex items-center justify-between hover:bg-haven-cream/20 transition-all cursor-pointer">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-haven-navy text-white rounded-xl flex items-center justify-center">
                         <CreditCard size={24} />
                      </div>
                      <div>
                         <span className="block font-bold text-haven-navy">Stripe Secured</span>
                         <span className="block text-xs text-gray-500 font-medium">Cartes Bancaires, Apple Pay, Google Pay</span>
                      </div>
                   </div>
                   <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:text-haven-navy transition-colors">
                      <Check size={18} />
                   </div>
                </div>

                <div className="bg-haven-cream p-4 rounded-xl space-y-2">
                   <div className="flex justify-between text-sm font-medium">
                      <span className="text-gray-500">Total à régler</span>
                      <span className="text-haven-navy">{total}€</span>
                   </div>
                </div>

                <div className="text-xs text-center text-gray-500 flex flex-col gap-1">
                  <span>Vous allez être redirigé vers la page de paiement sécurisé de Stripe.</span>
                  <span className="flex items-center justify-center gap-1"><ShieldCheck size={12}/> Vos données bancaires ne sont jamais stockées sur nos serveurs.</span>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
                    {error}
                  </div>
                )}

                <Button fullWidth onClick={handlePayment} disabled={isProcessing}>
                  {isProcessing ? 'Initialisation...' : `Procéder au paiement de ${total}€`}
                </Button>
              </div>
            )}

            {/* STEP 5: SUCCESS */}
            {step === 5 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check size={40} className="text-green-600" />
                </div>
                <h3 className="font-heading font-bold text-2xl text-haven-navy mb-2">Demande transmise avec succès !</h3>
                <p className="text-gray-600 mb-8 leading-relaxed max-w-sm mx-auto text-sm">
                  Votre demande a été envoyée au propriétaire qui dispose de **48 heures** pour y répondre. S'il l'accepte, vous disposerez ensuite de **72 heures** pour procéder au règlement afin de confirmer définitivement votre colocation.
                </p>
                <Button onClick={() => { onClose(); window.location.hash = '#/dashboard'; }}>
                  Aller au tableau de bord
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Legal Document Overlay (Pattern Login) */}
      {isLegalModalOpen && legalDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8">
          <div className="absolute inset-0 bg-haven-navy/80 backdrop-blur-md" onClick={() => setIsLegalModalOpen(false)} />
          <div className="relative bg-white w-full max-w-5xl h-full md:h-[90vh] md:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-haven-red/10 rounded-2xl flex items-center justify-center text-haven-red">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-xl text-haven-navy leading-none mb-1">{legalDoc.title}</h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Document officiel HAVEN</p>
                </div>
              </div>
              <button onClick={() => setIsLegalModalOpen(false)} className="w-12 h-12 rounded-2xl hover:bg-gray-100 flex items-center justify-center text-haven-stone transition-all hover:rotate-90">
                <XCircle size={28} />
              </button>
            </div>

            <div ref={modalScrollRef} onScroll={handleLegalScroll} className="flex-grow overflow-y-auto p-8 md:p-16 bg-white scroll-smooth leading-relaxed">
              <div className="max-w-3xl mx-auto">
                <div className="prose prose-slate max-w-none 
                  prose-headings:font-heading prose-headings:text-haven-navy prose-headings:font-bold
                  prose-p:text-haven-stone prose-p:text-lg prose-p:leading-relaxed prose-p:mb-6
                  prose-li:text-haven-stone prose-li:text-lg prose-li:mb-2
                  prose-strong:text-haven-navy prose-strong:font-bold
                ">
                  <div 
                    dangerouslySetInnerHTML={{ __html: legalDoc.content }} 
                  />
                </div>
              </div>
            </div>

            <div className="px-8 py-8 border-t border-gray-100 bg-gray-50/50 backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col gap-1">
                {!legalScrolled ? (
                  <div className="flex items-center gap-3 text-haven-red font-bold text-sm animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-haven-red/10 flex items-center justify-center">
                      <ArrowRight size={16} className="rotate-90" />
                    </div>
                    Veuillez faire défiler jusqu'en bas pour activer la validation
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-green-600 font-bold text-sm">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle size={16} />
                    </div>
                    Lecture terminée, vous pouvez maintenant accepter
                  </div>
                )}
              </div>
              
              <div className="flex gap-4 w-full md:w-auto">
                <Button variant="ghost" onClick={() => setIsLegalModalOpen(false)} className="px-8 py-4 font-bold">
                  Fermer
                </Button>
                <Button 
                  disabled={!legalScrolled}
                  onClick={() => {
                    setIsSigned(true);
                    setIsLegalModalOpen(false);
                  }}
                  className="px-12 py-4 font-bold min-w-[240px] shadow-xl shadow-haven-red/20"
                >
                  J'accepte et je valide
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};