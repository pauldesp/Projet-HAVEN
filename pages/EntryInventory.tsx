import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Booking, Listing, User, InventoryReport, InventoryItem, Room } from '../types';
import { Button } from '../components/Button';
import { 
  CheckCircle, 
  XCircle, 
  Camera, 
  Star, 
  Info, 
  ArrowRight, 
  Shield, 
  User as UserIcon, 
  Home, 
  Layout,
  Signature as SignatureIcon,
  Loader2,
  Calendar,
  Lock,
  ArrowLeft,
  Check,
  MapPin,
  CreditCard,
  FileText,
  List
} from 'lucide-react';
import { toast } from 'sonner';
import SignatureCanvas from 'react-signature-canvas';
import { motion, AnimatePresence } from 'motion/react';

const AMENITY_LABELS: Record<string, string> = {
  'wifi': 'Wi-Fi Haut débit',
  'tv': 'Télévision Smart TV',
  'kitchen': 'Cuisine équipée',
  'washing-machine': 'Lave-linge',
  'parking': 'Parking',
  'pool': 'Piscine',
  'gym': 'Salle de sport',
  'workspace': 'Espace de travail',
  'air-conditioning': 'Climatisation',
  'heating': 'Chauffage',
  'balcony': 'Balcon / Terrasse',
  'dishwasher': 'Lave-vaisselle',
  'elevator': 'Ascenseur',
  'coffee-maker': 'Machine à café',
  'hair-dryer': 'Sèche-cheveux',
  'iron': 'Fer à repasser',
  'essentials': 'Produits de base',
  'fire-extinguisher': 'Extincteur',
  'first-aid-kit': 'Kit de secours'
};

type Step = 'IDENTITY' | 'INVENTORY' | 'RATINGS' | 'RECAP' | 'SIGNATURE' | 'SUCCESS';

export const EntryInventory = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [booking, setBooking] = useState<Booking | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<Step>('IDENTITY');
  const [activeTab, setActiveTab] = useState<'PRIVATE' | 'COMMON'>('PRIVATE');
  
  const [inventoryData, setInventoryData] = useState<Partial<InventoryReport>>({
    identityValidated: false,
    items: [],
    roomRating: 0,
    houseRating: 0,
    cleanlinessRating: 0,
    comments: '',
    signature: '',
    status: 'DRAFT'
  });

  const sigCanvas = useRef<SignatureCanvas>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!bookingId) return;
      try {
        const b = await apiService.bookings.getById(bookingId);
        if (!b) {
          toast.error("Réservation introuvable");
          navigate('/');
          return;
        }
        setBooking(b);

        const l = await apiService.listings.getById(b.listingId);
        if (!l) {
          toast.error("Logement introuvable");
          return;
        }
        setListing(l);

        // Check if today is the check-in day
        const today = new Date().toISOString().split('T')[0];
        const checkInDate = b.startDate.split('T')[0];
        
        if (today !== checkInDate && b.status !== 'COMPLETED') {
           // For demo/dev purposes we might want to allow access, 
           // but user explicitly said "ne doit pas être possible de l'ouvrir avant"
           // I'll keep the strict check but maybe add a dev override if we were testing.
           // For now, I'll follow the requirement.
        }

        // Initialize inventory items based on listing
        const room = l.rooms.find(r => r.id === b.roomId);
        const privateItems: InventoryItem[] = [];
        if (room) {
          privateItems.push({ name: `Chambre: ${room.name}`, category: 'PRIVATE', isPresent: true, isFunctional: true });
          if (room.hasDesk) privateItems.push({ name: 'Bureau', category: 'PRIVATE', isPresent: true, isFunctional: true });
          if (room.hasWardrobe) privateItems.push({ name: 'Penderie / Armoire', category: 'PRIVATE', isPresent: true, isFunctional: true });
          if (room.hasLock) privateItems.push({ name: 'Verrou de porte', category: 'PRIVATE', isPresent: true, isFunctional: true });
          if (room.hasPrivateBath) privateItems.push({ name: 'Salle de bain privée', category: 'PRIVATE', isPresent: true, isFunctional: true });
          privateItems.push({ name: `Lit (${room.bedSize})`, category: 'PRIVATE', isPresent: true, isFunctional: true });
        }

        const commonItems: InventoryItem[] = l.amenities.map(a => ({
          name: AMENITY_LABELS[a] || a,
          category: 'COMMON',
          isPresent: true,
          isFunctional: true
        }));

        setInventoryData(prev => ({
          ...prev,
          items: [...privateItems, ...commonItems]
        }));

      } catch (e) {
        console.error("Error fetching inventory data", e);
        toast.error("Erreur lors du chargement");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [bookingId, navigate]);

  const handleItemChange = (index: number, updates: Partial<InventoryItem>) => {
    setInventoryData(prev => {
      const newItems = [...(prev.items || [])];
      newItems[index] = { ...newItems[index], ...updates };
      return { ...prev, items: newItems };
    });
  };

  const handleNext = () => {
    if (currentStep === 'IDENTITY') setCurrentStep('INVENTORY');
    else if (currentStep === 'INVENTORY') setCurrentStep('RATINGS');
    else if (currentStep === 'RATINGS') setCurrentStep('RECAP');
    else if (currentStep === 'RECAP') setCurrentStep('SIGNATURE');
  };

  const handleBack = () => {
    if (currentStep === 'INVENTORY') setCurrentStep('IDENTITY');
    else if (currentStep === 'RATINGS') setCurrentStep('INVENTORY');
    else if (currentStep === 'RECAP') setCurrentStep('RATINGS');
    else if (currentStep === 'SIGNATURE') setCurrentStep('RECAP');
  };

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  const saveSignature = () => {
    if (sigCanvas.current?.isEmpty()) {
      toast.error("Veuillez signer avant de valider");
      return;
    }
    const signatureData = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
    setInventoryData(prev => ({ ...prev, signature: signatureData }));
    handleSubmit(signatureData || '');
  };

  const handleSubmit = async (signature: string) => {
    if (!booking || !currentUser) return;
    
    try {
      const report: InventoryReport = {
        id: `inv-${Date.now()}`,
        bookingId: booking.id,
        tenantId: currentUser.id,
        ownerId: booking.ownerId,
        type: 'IN',
        date: new Date().toISOString(),
        identityValidated: inventoryData.identityValidated || true,
        items: inventoryData.items || [],
        roomRating: inventoryData.roomRating || 0,
        houseRating: inventoryData.houseRating || 0,
        cleanlinessRating: inventoryData.cleanlinessRating || 0,
        comments: inventoryData.comments || '',
        signature: signature,
        status: 'COMPLETED'
      };

      await apiService.inventory.create(report);
      // Update booking status if needed, though check-in is usually part of a booking
      toast.success("État des lieux validé avec succès !");
      setCurrentStep('SUCCESS');
    } catch (e) {
      console.error("Error submitting inventory", e);
      toast.error("Erreur lors de la validation");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-haven-cream flex items-center justify-center">
        <Loader2 className="animate-spin text-haven-navy" size={48} />
      </div>
    );
  }

  // Check if today is the check-in day
  const today = new Date().toISOString().split('T')[0];
  const checkInDate = booking?.startDate.split('T')[0];
  const isCheckInDay = today === checkInDate;

  // For testing, we might want to override this, but per requirement:
  if (!isCheckInDay && booking?.status !== 'COMPLETED') {
    return (
      <div className="min-h-screen bg-haven-cream flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-10 bg-white rounded-[3rem] shadow-premium">
          <Calendar className="mx-auto text-haven-stone mb-6" size={64} />
          <h1 className="text-3xl font-heading font-bold text-haven-navy mb-4">Accès non autorisé</h1>
          <p className="text-haven-stone mb-8">
            L'état des lieux d'entrée n'est accessible que le jour de votre arrivée prévue ({new Date(booking?.startDate || '').toLocaleDateString('fr-FR')}).
          </p>
          <Button fullWidth onClick={() => navigate('/dashboard')}>Retour au tableau de bord</Button>
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'IDENTITY':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-haven-red/10 rounded-full flex items-center justify-center mx-auto text-haven-red">
                <UserIcon size={40} />
              </div>
              <h2 className="text-3xl font-heading font-bold text-haven-navy">Vérification de votre identité</h2>
              <p className="text-haven-stone max-w-lg mx-auto">Veuillez confirmer que vos informations personnelles sont exactes avant de procéder à l'état des lieux.</p>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Prénom</label>
                  <div className="p-4 bg-gray-50 rounded-2xl text-haven-navy font-bold">{currentUser?.firstName}</div>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Nom</label>
                  <div className="p-4 bg-gray-50 rounded-2xl text-haven-navy font-bold">{currentUser?.lastName}</div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Email</label>
                  <div className="p-4 bg-gray-50 rounded-2xl text-haven-navy font-bold">{currentUser?.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-6 bg-haven-navy/5 rounded-3xl border border-haven-navy/10">
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => setInventoryData(prev => ({ ...prev, identityValidated: !prev.identityValidated }))}>
                  <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${inventoryData.identityValidated ? 'bg-haven-navy border-haven-navy text-white' : 'border-gray-200 bg-white'}`}>
                    {inventoryData.identityValidated && <Check size={20} />}
                  </div>
                  <span className="text-haven-navy font-bold">Je certifie que ces informations sont exactes</span>
                </div>
              </div>
            </div>

            <Button 
              fullWidth 
              size="lg" 
              onClick={handleNext} 
              disabled={!inventoryData.identityValidated}
              className="py-6 text-xl rounded-3xl"
            >
              Continuer vers l'inventaire <ArrowRight size={24} className="ml-2" />
            </Button>
          </motion.div>
        );

      case 'INVENTORY':
        const filteredItems = inventoryData.items?.filter(item => item.category === activeTab) || [];
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-heading font-bold text-haven-navy">Inventaire du logement</h2>
              <p className="text-haven-stone">Vérifiez la présence et le bon fonctionnement de chaque élément.</p>
            </div>

            <div className="flex bg-white p-2 rounded-3xl shadow-sm border border-gray-100 mb-8 max-w-sm mx-auto">
              <button 
                onClick={() => setActiveTab('PRIVATE')}
                className={`flex-1 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'PRIVATE' ? 'bg-haven-navy text-white shadow-lg' : 'text-haven-stone hover:text-haven-navy'}`}
              >
                <Lock size={18} /> Parties Privées
              </button>
              <button 
                onClick={() => setActiveTab('COMMON')}
                className={`flex-1 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'COMMON' ? 'bg-haven-navy text-white shadow-lg' : 'text-haven-stone hover:text-haven-navy'}`}
              >
                <Layout size={18} /> Communs
              </button>
            </div>

            <div className="space-y-4">
              {filteredItems.map((item, idx) => {
                const globalIdx = inventoryData.items?.findIndex(i => i === item) ?? -1;
                return (
                  <div key={idx} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-haven-navy/5 rounded-2xl flex items-center justify-center text-haven-navy">
                          <CheckCircle size={24} />
                        </div>
                        <h3 className="font-heading font-bold text-xl text-haven-navy">{item.name}</h3>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => handleItemChange(globalIdx, { isPresent: !item.isPresent })}
                          className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all border-2 ${item.isPresent ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-100 text-gray-400'}`}
                        >
                          {item.isPresent ? 'Présent' : 'Cocher si présent'}
                        </button>
                        <button 
                          onClick={() => handleItemChange(globalIdx, { isFunctional: !item.isFunctional })}
                          className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all border-2 ${item.isFunctional ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-100 text-gray-400'}`}
                        >
                          {item.isFunctional ? 'Fonctionnel' : 'Cocher si fonctionnel'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-50">
                      <div>
                        <textarea 
                          placeholder="Note ou observation (optionnel)..."
                          value={item.comment || ''}
                          onChange={(e) => handleItemChange(globalIdx, { comment: e.target.value })}
                          className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-haven-navy/20 min-h-[100px] resize-none"
                        />
                      </div>
                      <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-3xl p-6 hover:border-haven-navy/30 transition-all cursor-pointer group">
                        <Camera size={32} className="text-gray-300 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-gray-400 group-hover:text-haven-navy">Ajouter une photo</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4">
              <Button variant="ghost" onClick={handleBack} className="flex-1 py-6 rounded-3xl font-bold">Retour</Button>
              <Button onClick={handleNext} className="flex-[2] py-6 rounded-3xl text-xl">Valider les éléments <ArrowRight size={24} className="ml-2" /></Button>
            </div>
          </motion.div>
        );

      case 'RATINGS':
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8"
          >
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-heading font-bold text-haven-navy">Évaluations générales</h2>
              <p className="text-haven-stone">Attribuez une note aux différents aspects de votre logement.</p>
            </div>

            <div className="space-y-6">
              {[
                { key: 'roomRating' as const, label: 'État général de la chambre', desc: 'Mobilier, murs, sols de votre partie privée.' },
                { key: 'houseRating' as const, label: 'État général du logement', desc: 'Parties communes, cuisine, salon, équipements.' },
                { key: 'cleanlinessRating' as const, label: 'Niveau de propreté du locataire précédent', desc: "État de propreté tel que laissé par l'occupant avant votre arrivée." }
              ].map((rater) => (
                <div key={rater.key} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 text-center space-y-4">
                  <div>
                    <h3 className="font-heading font-bold text-2xl text-haven-navy">{rater.label}</h3>
                    <p className="text-sm text-haven-stone">{rater.desc}</p>
                  </div>
                  <div className="flex justify-center gap-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button 
                        key={star}
                        onClick={() => setInventoryData(prev => ({ ...prev, [rater.key]: star }))}
                        className={`transition-all duration-300 transform hover:scale-110 ${inventoryData[rater.key] >= star ? 'text-amber-400 drop-shadow-md' : 'text-gray-200'}`}
                      >
                        <Star size={48} fill={inventoryData[rater.key] >= star ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <Button variant="ghost" onClick={handleBack} className="flex-1 py-6 rounded-3xl font-bold">Retour</Button>
              <Button 
                onClick={handleNext} 
                disabled={!inventoryData.roomRating || !inventoryData.houseRating || !inventoryData.cleanlinessRating}
                className="flex-[2] py-6 rounded-3xl text-xl"
              >
                Passer au récapitulatif <ArrowRight size={24} className="ml-2" />
              </Button>
            </div>
          </motion.div>
        );

      case 'RECAP':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-heading font-bold text-haven-navy">Récapitulatif de votre location</h2>
            </div>

            <div className="bg-white rounded-[3rem] overflow-hidden shadow-premium border border-gray-100">
              <div className="aspect-[21/9] bg-gray-200 relative">
                <img 
                  src={listing?.mainPhotoUrl} 
                  alt={listing?.title} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-haven-navy/80 to-transparent" />
                <div className="absolute bottom-6 left-8 text-white">
                  <h3 className="text-3xl font-heading font-bold">{listing?.title}</h3>
                  <div className="flex items-center gap-2 text-white/80">
                    <MapPin size={18} /> {listing?.city}, {listing?.address}
                  </div>
                </div>
              </div>

              <div className="p-10 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-haven-stone text-xs font-black uppercase tracking-widest">
                       <Calendar size={14} className="text-haven-red" /> Dates du séjour
                    </div>
                    <p className="text-haven-navy font-bold">
                      {new Date(booking?.startDate || '').toLocaleDateString('fr-FR')} au {new Date(booking?.endDate || '').toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-haven-stone text-xs font-black uppercase tracking-widest">
                       <CreditCard size={14} className="text-haven-red" /> Montant du séjour
                    </div>
                    <p className="text-haven-navy font-bold">{booking?.totalPrice}€ au total</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-haven-stone text-xs font-black uppercase tracking-widest">
                       <Shield size={14} className="text-haven-red" /> Caution déposée
                    </div>
                    <p className="text-haven-navy font-bold">Empreinte bancaire conservée</p>
                  </div>
                </div>

                <div className="bg-haven-red/5 p-8 rounded-3xl border border-haven-red/10 flex items-start gap-4">
                  <Info className="text-haven-red mt-1 shrink-0" size={20} />
                  <div className="space-y-1">
                    <p className="text-haven-navy font-bold">Note sur le ménage</p>
                    <p className="text-sm text-haven-stone leading-relaxed">
                      Un ménage professionnel est effectué chaque fin de semaine. En tant que locataire, vous êtes responsable de la propreté de votre chambre et du maintien quotidien des communs.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="ghost" onClick={handleBack} className="flex-1 py-6 rounded-3xl font-bold">Retour</Button>
              <Button onClick={handleNext} className="flex-[2] py-6 rounded-3xl text-xl">Procéder à la signature <ArrowRight size={24} className="ml-2" /></Button>
            </div>
          </motion.div>
        );

      case 'SIGNATURE':
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8"
          >
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-heading font-bold text-haven-navy">Signature finale</h2>
              <p className="text-haven-stone">Signez ci-dessous pour valider officiellement votre état des lieux d'entrée.</p>
            </div>

            <div className="bg-white rounded-[3rem] p-1 shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 p-4 flex justify-between items-center border-b border-gray-100">
                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Espace de signature</span>
                <button onClick={clearSignature} className="text-haven-red text-xs font-bold hover:underline">Effacer</button>
              </div>
              <SignatureCanvas 
                ref={sigCanvas}
                penColor="#0C2036"
                canvasProps={{ 
                  className: "signature-canvas w-full h-[300px] cursor-crosshair",
                  style: { width: '100%', height: '300px' } 
                }}
              />
            </div>

            <div className="flex gap-4">
              <Button variant="ghost" onClick={handleBack} className="flex-1 py-6 rounded-3xl font-bold">Retour</Button>
              <Button onClick={saveSignature} className="flex-[2] py-6 rounded-3xl text-xl">Signer et Terminer <SignatureIcon size={24} className="ml-2" /></Button>
            </div>
          </motion.div>
        );

      case 'SUCCESS':
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8"
          >
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 shadow-lg shadow-green-100/50">
              <CheckCircle size={56} />
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl font-heading font-bold text-haven-navy">Bienvenue chez vous !</h1>
              <p className="text-haven-stone text-lg max-w-md mx-auto leading-relaxed">
                Votre état des lieux d'entrée est validé. Vous recevrez une copie par email. Nous vous souhaitons un excellent séjour.
              </p>
            </div>
            <div className="pt-8">
              <Button size="lg" onClick={() => navigate('/dashboard')} className="px-12 py-5 text-lg rounded-3xl">
                Aller au tableau de bord
              </Button>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-haven-cream py-12 px-6">
      <div className="max-w-3xl mx-auto space-y-12">
        {/* Progress Bar */}
        {currentStep !== 'SUCCESS' && (
          <div className="flex items-center justify-between mb-12 bg-white/50 backdrop-blur-sm p-4 rounded-3xl border border-white">
            {[
              { id: 'IDENTITY', icon: UserIcon, label: 'Identité' },
              { id: 'INVENTORY', icon: List, label: 'Inventaire' },
              { id: 'RATINGS', icon: Star, label: 'Notes' },
              { id: 'RECAP', icon: FileText, label: 'Récap' },
              { id: 'SIGNATURE', icon: SignatureIcon, label: 'Signature' }
            ].map((step, idx, arr) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isPast = arr.findIndex(s => s.id === currentStep) > idx;
              
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      isActive ? 'bg-haven-navy text-white shadow-xl scale-110' : 
                      isPast ? 'bg-green-100 text-green-600' : 'bg-white text-gray-300'
                    }`}>
                      {isPast ? <Check size={24} /> : <StepIcon size={24} />}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-haven-navy' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < arr.length - 1 && (
                    <div className="flex-grow h-px bg-gray-100 mx-2" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {renderStep()}
      </div>
    </div>
  );
};
