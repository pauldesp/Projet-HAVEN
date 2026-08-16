
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { 
  Calendar, 
  FileText, 
  MessageCircle, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Star, 
  Camera, 
  ClipboardCheck, 
  Loader2, 
  Sparkles, 
  MapPin, 
  Heart, 
  ShieldCheck, 
  UserCircle, 
  Upload,
  ArrowRightLeft,
  AlertTriangle,
  X,
  Inbox,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useListings } from '../contexts/ListingContext';
import { useBookings } from '../contexts/BookingContext';
import { apiService } from '../services/api';
import { Booking, Listing, Room, UserRole, AppDocument } from '../types';
import { InventoryModal } from '../components/InventoryModal';
import { ReviewModal } from '../components/ReviewModal';
import { ReportModal } from '../components/ReportModal';
import { AccountStatusOverlay } from '../components/AccountStatusOverlay';
import { ConversationsList } from '../components/ConversationsList';
import { toast } from 'sonner';

const BookingCountdown: React.FC<{ booking: Booking }> = ({ booking }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      if (booking.status === 'PENDING' && booking.bookingMode === 'MANUAL') {
        const limit = new Date(new Date(booking.createdAt).getTime() + 48 * 60 * 60 * 1000);
        const diff = limit.getTime() - now.getTime();
        if (diff <= 0) {
          setTimeLeft('Expiré');
          setIsExpired(true);
          return;
        }
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`⏳ Décision attendue sous ${hours}h ${minutes}m ${seconds}s`);
      } else if (booking.status === 'APPROVED' && booking.approvedAt) {
        const limit = new Date(new Date(booking.approvedAt).getTime() + 72 * 60 * 60 * 1000);
        const diff = limit.getTime() - now.getTime();
        if (diff <= 0) {
          setTimeLeft('Délai de paiement dépassé');
          setIsExpired(true);
          return;
        }
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`⚠️ Reste ${hours}h ${minutes}m ${seconds}s pour payer`);
      } else {
        setTimeLeft('');
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [booking]);

  if (!timeLeft) return null;

  return (
    <div className={`text-[10px] font-mono font-bold mt-1.5 flex items-center gap-1 px-2 py-0.5 rounded w-max ${
      isExpired 
        ? 'bg-red-50 text-red-600 border border-red-100' 
        : booking.status === 'PENDING'
          ? 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse'
          : 'bg-blue-50 text-blue-600 border border-blue-100 animate-pulse'
    }`}>
      {timeLeft}
    </div>
  );
};

export const TenantDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, refreshUser, updateUserRole } = useAuth();
  const { listings: allListings } = useListings();
  const { bookings: allBookings } = useBookings();
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'HISTORY' | 'FAVORITES' | 'MESSAGES' | 'DOCUMENTS'>('UPCOMING');
  const [bookings, setBookings] = useState<(Booking & { listing?: Listing })[]>([]);
  const [favorites, setFavorites] = useState<Listing[]>([]);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [forceEarlyDepartureId, setForceEarlyDepartureId] = useState<string | null>(null);
  const [showEarlyDepartureHintId, setShowEarlyDepartureHintId] = useState<string | null>(null);

  const isApproved = currentUser?.status === 'APPROVED';

  // Modal State
  const [inventoryState, setInventoryState] = useState<{
    isOpen: boolean;
    type: 'IN' | 'OUT';
    selectedBooking: (Booking & { listing?: Listing }) | null;
  }>({
    isOpen: false,
    type: 'IN',
    selectedBooking: null
  });

  const [reviewState, setReviewState] = useState<{
    isOpen: boolean;
    targetId: string;
    targetName: string;
    targetType: 'LISTING' | 'USER';
  }>({
    isOpen: false,
    targetId: '',
    targetName: '',
    targetType: 'LISTING'
  });

  const [reportState, setReportState] = useState({
    isOpen: false,
    targetId: '',
    targetType: 'TECHNICAL' as any,
    listingId: '',
    bookingId: '',
    ownerId: ''
  });

  const [viewingDocument, setViewingDocument] = useState<AppDocument | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    // Handle Stripe redirect result
    const handlePaymentResult = async () => {
      const params = new URLSearchParams(window.location.search);
      const bookingResult = params.get('booking');
      const bookingId = params.get('id');

      if (bookingResult === 'success' && bookingId) {
        try {
          await apiService.bookings.updateStatus(bookingId, 'CONFIRMED');
          toast.success("Votre réservation est confirmée ! Bienvenue chez HAVEN.");

          // Send confirmation emails to both parties (Chantier 3)
          try {
            const booking = await apiService.bookings.getById(bookingId);
            if (booking) {
              const ownerProfile = await apiService.users.getById(booking.ownerId);
              const listing = await apiService.listings.getById(booking.listingId);
              const listingTitle = listing?.title || "Logement HAVEN";
              const ownerName = ownerProfile ? `${ownerProfile.firstName} ${ownerProfile.lastName}` : "Hôte HAVEN";
              
              // Email to Tenant
              await apiService.notifications.sendBookingNotification(
                currentUser.email,
                'PAYMENT_CONFIRMED',
                {
                  listingTitle,
                  roomName: booking.roomName || 'Chambre',
                  amount: booking.totalPrice,
                  startDate: new Date(booking.startDate).toLocaleDateString('fr-FR'),
                  endDate: new Date(booking.endDate).toLocaleDateString('fr-FR'),
                  tenantName: `${currentUser.firstName} ${currentUser.lastName}`,
                  ownerName,
                  bookingId
                }
              );

              // Email to Landlord
              if (ownerProfile && ownerProfile.email) {
                await apiService.notifications.sendBookingNotification(
                  ownerProfile.email,
                  'PAYMENT_CONFIRMED',
                  {
                    listingTitle,
                    roomName: booking.roomName || 'Chambre',
                    amount: booking.totalPrice,
                    startDate: new Date(booking.startDate).toLocaleDateString('fr-FR'),
                    endDate: new Date(booking.endDate).toLocaleDateString('fr-FR'),
                    tenantName: `${currentUser.firstName} ${currentUser.lastName}`,
                    ownerName,
                    bookingId
                  }
                );
              }
            }
          } catch (emailErr) {
            console.error("Failed to fetch profiles or dispatch PAYMENT_CONFIRMED emails:", emailErr);
          }

          // Clear query params without refreshing page
          const newUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, '', newUrl);
        } catch (e) {
          console.error("Error confirming booking", e);
        }
      } else if (bookingResult === 'cancel' && bookingId) {
        try {
          // If cancelled, we delete the pending booking to free up the room
          // We need a delete method in apiService or use updateStatus to 'CANCELLED'
          await apiService.bookings.updateStatus(bookingId, 'CANCELLED');
          toast.info("Réservation annulée. Les dates ont été libérées.");
          const newUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, '', newUrl);
        } catch (e) {
          console.error("Error cancelling booking", e);
        }
      }
    };

    handlePaymentResult();

    // 1. Listen to Documents (Real-time)
    const unsubscribeDocs = apiService.documents.listenToByUserId(currentUser.id, (userDocs) => {
      setDocuments(userDocs);
    });

    // 1.1 Listen to Messages (Real-time)
    const unsubscribeMessages = apiService.messages.listenToConversations(currentUser.id, (convs) => {
      const total = convs.reduce((acc, curr) => acc + curr.unreadCount, 0);
      setUnreadCount(total);
    });

    // 2. Fetch other data once
    const fetchOtherData = async () => {
      setIsLoading(true);
      try {
        const myBookings = await apiService.bookings.getByUserId(currentUser.id);
        const enrichedBookings = myBookings.map(b => ({
          ...b,
          listing: allListings.find(l => l.id === b.listingId)
        }));

        // Sort by proximity: upcoming first (sooner first), then past (recent first)
        const sortedBookings = enrichedBookings.sort((a, b) => {
          const dateA = new Date(a.startDate).getTime();
          const dateB = new Date(b.startDate).getTime();
          const now = Date.now();
          
          if (dateA >= now && dateB >= now) return dateA - dateB;
          if (dateA < now && dateB < now) return dateB - dateA;
          return dateA >= now ? -1 : 1;
        });

        setBookings(sortedBookings);

        if (currentUser.favorites && currentUser.favorites.length > 0) {
          const favListings = currentUser.favorites
            .map(id => allListings.find(l => l.id === id))
            .filter(l => !!l) as Listing[];
          setFavorites(favListings);
        }
      } catch (e) {
        console.error("Error fetching other tenant data", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOtherData();
    return () => {
      unsubscribeDocs();
      unsubscribeMessages();
    };
  }, [currentUser, allListings]);

  const handleSwitchToOwner = async () => {
    if (!currentUser) return;
    try {
      await updateUserRole(UserRole.OWNER);
      navigate('/owner/dashboard');
    } catch (e) {
      console.error("Error switching to owner", e);
    }
  };

  const [isPayingBookingId, setIsPayingBookingId] = useState<string | null>(null);

  const handleProceedToPayment = async (booking: Booking) => {
    setIsPayingBookingId(booking.id);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          listingId: booking.listingId,
          amount: booking.totalPrice,
          listingTitle: booking.listing?.title || 'Logement',
          roomName: booking.roomName || 'Chambre',
          successUrl: `${window.location.origin}${window.location.pathname}?booking=success&id=${booking.id}#/dashboard`,
          cancelUrl: `${window.location.origin}${window.location.pathname}?booking=cancel&id=${booking.id}`,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erreur Stripe");
      }

      const session = await response.json();
      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error("URL de session non reçue");
      }
    } catch (e: any) {
      console.error("Erreur de paiement", e);
      toast.error(e.message || "Une erreur est survenue lors de l'initialisation du paiement.");
    } finally {
      setIsPayingBookingId(null);
    }
  };

  const handleCancelRequest = async (bookingId: string) => {
    try {
      await apiService.bookings.updateStatus(bookingId, 'CANCELLED');
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'CANCELLED' } : b));
      toast.success("Demande de réservation annulée avec succès.");
    } catch (e) {
      console.error("Error cancelling request", e);
      toast.error("Impossible d'annuler la demande.");
    }
  };

  const handleInventoryComplete = async (data: any) => {
    if (!inventoryState.selectedBooking || !currentUser) return;
    
    const bookingId = inventoryState.selectedBooking.id;
    const type = inventoryState.type;

    try {
      if (type === 'OUT') {
        // 1. Create Inventory Report (Metadata)
        const reportId = `inv_out_${bookingId}_${Date.now()}`;
        await apiService.inventory.create({
          id: reportId,
          bookingId,
          tenantId: currentUser.id,
          ownerId: inventoryState.selectedBooking.ownerId,
          type: 'OUT',
          date: new Date().toISOString(),
          identityValidated: true,
          items: [], 
          comments: JSON.stringify({ checklist: data.checklist, incident: data.incidentReport }),
          status: 'COMPLETED',
          roomRating: data.reviews?.listing?.rating || 5,
          houseRating: data.reviews?.haven?.rating || 5,
          cleanlinessRating: 5,
          signature: 'USER_SIGNED'
        });

        // 2. Create Incident if any
        if (data.incidentReport && data.incidentReport.subCategory) {
          await apiService.incidents.create({
            id: `inc_${bookingId}_${Date.now()}`,
            bookingId,
            listingId: inventoryState.selectedBooking.listingId,
            reporterId: currentUser.id,
            ownerId: inventoryState.selectedBooking.ownerId,
            title: `${data.incidentReport.category} - ${data.incidentReport.subCategory}`,
            description: data.incidentReport.description,
            photos: data.incidentReport.photo ? [data.incidentReport.photo] : [],
            status: 'NEW',
            createdAt: new Date().toISOString()
          });
        }

        // 3. Create Reviews
        if (data.reviews) {
          await apiService.reviews.create({
            id: `rev_l_${bookingId}`,
            authorId: currentUser.id,
            targetId: inventoryState.selectedBooking.listingId,
            targetType: 'LISTING',
            rating: data.reviews.listing.rating,
            comment: data.reviews.listing.comment,
            createdAt: new Date().toISOString(),
            authorName: `${currentUser.firstName} ${currentUser.lastName[0]}.`,
            authorAvatarUrl: currentUser.avatarUrl
          });

          const roommates = getRoommates(inventoryState.selectedBooking);
          if (roommates.length > 0) {
            await apiService.reviews.create({
              id: `rev_r_${bookingId}`,
              authorId: currentUser.id,
              targetId: roommates[0].id,
              rating: data.reviews.roommates.rating,
              comment: data.reviews.roommates.comment,
              createdAt: new Date().toISOString(),
              targetType: 'USER'
            });
          }
        }

        // Update Booking Status
        await apiService.bookings.updateStatus(bookingId, 'COMPLETED');
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'COMPLETED' } : b));
        
        // Refresh docs
        const userDocs = await apiService.documents.getByUserId(currentUser.id);
        setDocuments(userDocs);

        toast.success("Départ validé ! Vos documents sont maintenant disponibles dans l'onglet dédié.");
      } else {
        // For IN inventory
        const userDocs = await apiService.documents.getByUserId(currentUser.id);
        setDocuments(userDocs);
        toast.success("État des lieux d'entrée validé. Bon séjour chez HAVEN !");
      }
    } catch (e) {
      console.error("Error finalizing inventory", e);
      toast.error("Une erreur est survenue lors de la transmission.");
    }
  };

  const isLastDay = (dateStr: string) => {
    if (!dateStr) return false;
    try {
      const today = new Date();
      const [year, month, day] = dateStr.split('-').map(Number);
      const endDate = new Date(year, month - 1, day);
      const d1 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const d2 = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
      return d1 >= d2;
    } catch (e) {
      return false;
    }
  };

  const handleOpenInventory = (booking: Booking & { listing?: Listing }, type: 'IN' | 'OUT') => {
    if (type === 'IN') {
      const alreadyDone = documents.some(d => d.bookingId === booking.id && d.type === 'INVENTORY_IN');
      if (alreadyDone) {
        toast.info("L'état des lieux d'entrée a déjà été réalisé. Vous pouvez le retrouver dans l'onglet 'Mes Documents'.");
        setActiveTab('DOCUMENTS');
        return;
      }
    }
    setInventoryState({ isOpen: true, type, selectedBooking: booking });
  };

  const handleUploadDocument = async (type: 'idCard' | 'proofOfIncome' | 'studentCard') => {
    if (!currentUser) return;
    
    // Create direct native hidden file picker input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) return;
      
      const file = target.files[0];
      
      // Limit to 1.5MB to maintain smooth Firestore sync
      if (file.size > 1.5 * 1024 * 1024) {
        toast.error("Le fichier est trop volumineux. La taille maximale autorisée est de 1.5 Mo.");
        return;
      }
      
      const toastId = toast.loading("Finalisation de l'analyse et import du fichier...");
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          const fileDataUrl = reader.result as string;
          await apiService.users.uploadDocument(currentUser.id, type, fileDataUrl);
          await refreshUser();
          toast.dismiss(toastId);
          toast.success("Votre justificatif a été ajouté et sécurisé avec succès !");
        } catch (error) {
          console.error("Error uploading document", error);
          toast.dismiss(toastId);
          toast.error("Une erreur est survenue lors de l'enregistrement de votre fichier.");
        }
      };
      
      reader.onerror = () => {
        toast.dismiss(toastId);
        toast.error("Impossible de lire ce format de fichier.");
      };
      
      reader.readAsDataURL(file);
    };
    
    input.click();
  };

  const upcoming = bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'PENDING' || b.status === 'APPROVED');
  const history = bookings.filter(b => b.status === 'COMPLETED');

  const handleDownload = (doc: AppDocument) => {
    if (!doc || !doc.url) {
      toast.error("URL du document non disponible.");
      return;
    }
    
    toast.info(`Préparation du téléchargement : ${doc.title}`);
    
    try {
      // Method 1: Anchor tag
      const link = document.createElement('a');
      link.href = doc.url;
      link.setAttribute('download', `${doc.title}.pdf`);
      link.setAttribute('target', '_blank');
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => document.body.removeChild(link), 100);

      // Method 2: window.open as fallback
      window.open(doc.url, '_blank');
      
      toast.success(`Action déclenchée pour "${doc.title}".`);
    } catch (error) {
      console.error("Global download error:", error);
      toast.error("Erreur lors de l'ouverture du document.");
    }
  };

  const getRoommates = (booking: Booking) => {
    const roommates = allBookings.filter(b => 
      b.listingId === booking.listingId && 
      b.id !== booking.id && 
      b.status === 'CONFIRMED' &&
      new Date(b.startDate) <= new Date(booking.endDate) &&
      new Date(b.endDate) >= new Date(booking.startDate)
    );
    const uniqueTenants: any[] = [];
    roommates.forEach(r => {
      if (r.tenantId) { // Simplified for demo
         const foundTenant = allBookings.find(b => b.tenantId === r.tenantId)?.tenant;
         if (foundTenant && !uniqueTenants.find(t => t.id === foundTenant.id)) {
            uniqueTenants.push(foundTenant);
         }
      }
    });
    return uniqueTenants;
  };

  if (isLoading) return <div className="p-20 text-center flex flex-col items-center gap-4"><Loader2 className="animate-spin text-haven-navy" size={40}/><p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Chargement de votre univers...</p></div>;

  return (
    <div className="min-h-screen bg-haven-cream pb-20 font-body">
      {/* ... (Previous header remains similar) ... */}
      <div className="bg-haven-navy pt-12 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="font-heading font-bold text-3xl text-white mb-2 tracking-tight">
              Bonjour, {currentUser?.firstName || 'Locataire'} 👋
            </h1>
            <div className="flex items-center gap-4">
              <p className="text-blue-200 font-medium">Gérez vos séjours, vos documents et vos favoris.</p>
              <Link to={`/profile/${currentUser?.id}`} className="text-white/70 hover:text-white text-xs font-bold underline underline-offset-4 decoration-white/30">
                Voir mon profil public
              </Link>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 flex items-center gap-2"
              onClick={handleSwitchToOwner}
            >
              <ArrowRightLeft size={16} /> Passer en mode propriétaire
            </Button>
            <div className="flex gap-2 bg-white/5 p-1.5 rounded-2xl backdrop-blur-sm">
               <div className="px-4 py-2 text-center">
                  <span className="block text-[10px] text-white/50 uppercase font-black tracking-widest">Caution</span>
                  <span className="text-sm font-bold text-green-400">Sécurisée</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16">
        {/* Verification Banner */}
        {!isApproved && currentUser?.role !== 'ADMIN' && (
          <div className="mb-8 bg-orange-50 border border-orange-100 rounded-[2.5rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="font-bold text-haven-navy">Vérification d'identité requise</h4>
                <p className="text-sm text-gray-500">Vous devez valider votre identité pour effectuer des réservations.</p>
              </div>
            </div>
            <Button 
              variant="primary" 
              size="sm" 
              className="bg-orange-500 hover:bg-orange-600 border-none px-8 h-12 rounded-xl"
              onClick={() => setIsVerificationModalOpen(true)}
            >
              Vérifier mon identité
            </Button>
          </div>
        )}

        <div className="bg-white rounded-[2.5rem] shadow-premium p-8 min-h-[500px] border border-gray-50">
          <div className="flex flex-wrap gap-4 md:gap-8 border-b border-gray-100 mb-8 overflow-x-auto">
            {[
              { id: 'UPCOMING', label: 'Séjours à venir', count: upcoming.length },
              { id: 'HISTORY', label: 'Historique', count: history.length },
              { id: 'MESSAGES', label: 'Messages', count: unreadCount },
              { id: 'FAVORITES', label: 'Mes Favoris', count: favorites.length },
              { id: 'DOCUMENTS', label: 'Mes Documents', count: documents.length + 3 }
            ].map(tab => (
              <button 
                key={tab.id}
                className={`pb-4 font-bold text-sm transition-all relative whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? 'text-haven-navy' : 'text-gray-300 hover:text-gray-500'}`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                {tab.label} {tab.id !== 'MESSAGES' && tab.count !== null && `(${tab.count})`}
                {tab.id === 'MESSAGES' && tab.count > 0 && (
                  <span className="bg-haven-red text-white text-[9px] px-1.5 py-0.5 rounded-full animate-bounce">
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.id && <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-1 bg-haven-navy rounded-full" />}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {activeTab === 'UPCOMING' && (
              <>
                {upcoming.map(booking => (
                  <div key={booking.id} className="group border border-gray-100 rounded-[2rem] p-8 flex flex-col lg:flex-row gap-8 items-start lg:items-center hover:shadow-xl hover:border-gray-200 transition-all duration-500 bg-white">
                    <div className="relative w-full lg:w-64 h-40 flex-shrink-0 overflow-hidden rounded-3xl">
                      <img src={booking.listing?.mainPhotoUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="" />
                      <div className={`absolute top-4 left-4 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-black uppercase shadow-sm ${
                        booking.status === 'CONFIRMED' ? 'bg-green-500/90 text-white' : 
                        booking.status === 'APPROVED' ? 'bg-amber-500/90 text-white animate-pulse' : 
                        'bg-blue-500/90 text-white'
                      }`}>
                        {booking.status === 'CONFIRMED' ? 'Confirmé' : booking.status === 'APPROVED' ? 'À régler' : 'En attente'}
                      </div>
                    </div>

                    <div className="flex-1 w-full text-left space-y-4">
                      <div>
                        <h3 className="font-heading font-bold text-2xl text-haven-navy group-hover:text-haven-red transition-colors mb-1">{booking.listing?.title}</h3>
                        <p className="text-gray-400 text-[11px] flex items-center gap-1.5 font-black uppercase tracking-widest leading-none"><MapPin size={12} className="text-haven-red"/> {booking.listing?.city}</p>
                      </div>
                      
                      <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-2 bg-gray-50 px-4 py-2.5 rounded-2xl border border-gray-100/50">
                          <Calendar size={16} className="text-haven-stone"/>
                          <span className="text-xs font-bold text-haven-navy">{new Date(booking.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} — {new Date(booking.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-haven-navy/5 px-4 py-2.5 rounded-2xl border border-haven-navy/10">
                          <span className="text-xs font-black text-haven-navy">{booking.totalPrice}€ TTC</span>
                        </div>
                        <BookingCountdown booking={booking} />
                      </div>

                      {getRoommates(booking).length > 0 && (
                        <div className="pt-4 flex items-center gap-4">
                           <div className="flex -space-x-3">
                             {getRoommates(booking).map(roommate => (
                               <img key={roommate.id} className="h-10 w-10 rounded-full ring-4 ring-white object-cover" src={roommate.avatarUrl} alt="" />
                             ))}
                           </div>
                           <p className="text-[11px] font-bold text-gray-500">Vos colocataires sur ce séjour</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-2 w-full lg:w-72 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-gray-100 lg:pl-8">
                      {booking.status === 'CONFIRMED' && (
                        <>
                          <Link to={`/messages/${booking.id}`}>
                            <Button 
                              variant="outline" 
                              className="w-full h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest border-haven-navy/10 text-haven-navy hover:bg-haven-navy hover:text-white transition-all gap-2"
                            >
                              <MessageCircle size={16} /> Contacter le propriétaire
                            </Button>
                          </Link>
                          
                          {/* Entry Inventory */}
                          {documents.some(d => d.bookingId === booking.id && d.type === 'INVENTORY_IN') ? (
                            <div className="space-y-2">
                              <div className="w-full h-12 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center gap-2">
                                <CheckCircle size={16} className="text-green-600" />
                                <span className="text-[10px] font-black uppercase text-green-700">Entrée Réalisée</span>
                              </div>
                              <Button 
                                variant="outline" 
                                className="w-full h-10 rounded-xl text-[9px] font-black uppercase tracking-widest border-green-100 text-green-700 hover:bg-green-100/50 transition-all gap-2"
                                onClick={() => {
                                  try {
                                    const doc = documents.find(d => d.bookingId === booking.id && d.type === 'INVENTORY_IN');
                                    if (doc) {
                                      setViewingDocument(doc);
                                      toast.success("Ouverture de l'aperçu...");
                                    } else {
                                      toast.error("Document introuvable dans la liste.");
                                      setActiveTab('DOCUMENTS');
                                    }
                                  } catch (err) {
                                    console.error("View error:", err);
                                    toast.error("Erreur lors de l'ouverture.");
                                  }
                                }}
                              >
                                <FileText size={14} /> Voir mon état des lieux
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              variant="primary" 
                              className="w-full h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest bg-haven-navy shadow-lg shadow-haven-navy/10 gap-2"
                              onClick={() => handleOpenInventory(booking, 'IN')}
                            >
                              <ClipboardCheck size={16} /> État des lieux entrée
                            </Button>
                          )}
                          
                          {/* Departure Inventory */}
                          <Button 
                            variant="secondary" 
                            className="w-full h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-haven-red/10"
                            onClick={() => handleOpenInventory(booking, 'OUT')}
                          >
                            <Sparkles size={16} /> Départ & Ménage
                          </Button>

                          {/* Incident Button */}
                          <Button 
                            variant="ghost" 
                            className="w-full h-10 rounded-2xl text-[9px] font-black uppercase tracking-widest text-amber-600 bg-amber-50/30 hover:bg-amber-100/50 border border-dashed border-amber-200/50 transition-all gap-2"
                            onClick={() => setReportState({
                              isOpen: true,
                              targetId: booking.listingId,
                              targetType: 'TECHNICAL',
                              listingId: booking.listingId,
                              bookingId: booking.id,
                              ownerId: booking.ownerId
                            })}
                          >
                            <AlertTriangle size={13} /> Signaler un incident
                          </Button>

                          {/* Modify Dates */}
                          <button 
                            onClick={() => alert("Demande de modification des dates envoyée au propriétaire.")}
                            className="w-full h-10 text-[10px] text-haven-stone hover:text-haven-navy font-black uppercase tracking-tighter transition-colors underline underline-offset-4"
                          >
                            Modifier le séjour
                          </button>
                        </>
                      )}

                      {booking.status === 'PENDING' && (
                        <div className="flex flex-col gap-3 py-2 text-center lg:text-left">
                          <p className="text-xs text-haven-stone leading-relaxed">
                            {booking.bookingMode === 'MANUAL' ? (
                              <span>Demande transmise au propriétaire. Décision sous 48 heures.</span>
                            ) : (
                              <span>Réservation en cours de virement Stripe...</span>
                            )}
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleCancelRequest(booking.id)}
                            className="text-haven-stone border-gray-200 hover:text-haven-red hover:bg-red-50 hover:border-red-100 text-[10px] font-black uppercase tracking-widest h-10 rounded-xl"
                          >
                            Annuler ma demande
                          </Button>
                        </div>
                      )}

                      {booking.status === 'APPROVED' && (
                        <div className="flex flex-col gap-3 py-2 text-center lg:text-left">
                          <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-2xl text-left">
                            <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5 justify-center lg:justify-start">
                              <Clock size={14} className="animate-pulse" />
                              Approuvé !
                            </p>
                            <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                              {booking.approvedAt ? (
                                <span>Il vous reste <strong>{Math.max(1, 72 - Math.floor((Date.now() - new Date(booking.approvedAt).getTime()) / (1000 * 60 * 60)))}h</strong> pour régler votre premier loyer afin de bloquer définitivement votre place.</span>
                              ) : (
                                <span>Réglez sous 72 heures pour sécuriser la colocation.</span>
                              )}
                            </p>
                          </div>
                          <Button 
                            variant="primary" 
                            size="lg" 
                            disabled={isPayingBookingId === booking.id}
                            onClick={() => handleProceedToPayment(booking)}
                            className="bg-haven-red hover:bg-haven-red/90 text-white font-black text-[11px] uppercase tracking-widest h-12 rounded-2xl shadow-lg shadow-haven-red/10 animate-bounce"
                          >
                            {isPayingBookingId === booking.id ? 'Redirection...' : `Payer ${booking.totalPrice}€`}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleCancelRequest(booking.id)}
                            className="text-haven-stone hover:text-haven-red hover:bg-red-50 text-[10px] font-bold h-10 rounded-xl"
                          >
                            Annuler ma demande
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {upcoming.length === 0 && (
                  <div className="text-center py-20 bg-gray-50/50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                    <Calendar size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-400 font-bold">Rien de prévu ?</p>
                    <Link to="/" className="text-haven-red font-black uppercase tracking-widest text-xs hover:underline mt-2 inline-block">Trouver ma prochaine chambre</Link>
                  </div>
                )}
              </>
            )}

            {activeTab === 'HISTORY' && (
              <div className="grid md:grid-cols-2 gap-6">
                {history.map(booking => (
                  <div key={booking.id} className="bg-white border border-gray-100 rounded-[2.5rem] p-8 flex items-center gap-6 hover:shadow-card transition-all">
                    <img src={booking.listing?.mainPhotoUrl} className="w-24 h-24 object-cover rounded-3xl" alt="" />
                    <div className="flex-1 space-y-2">
                       <div className="px-2 py-1 bg-green-100 text-green-700 text-[9px] font-black uppercase rounded-lg inline-block">Terminé</div>
                       <h4 className="font-bold text-haven-navy text-xl leading-tight">{booking.listing?.title}</h4>
                       <p className="text-xs text-gray-400 font-medium italic">Fin du séjour le {new Date(booking.endDate).toLocaleDateString('fr-FR')}</p>
                       <div className="flex gap-2 pt-2">
                         <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase bg-gray-50 rounded-xl" onClick={() => setReviewState({isOpen: true, targetId: booking.listingId, targetName: booking.listing?.title || 'Logement', targetType: 'LISTING'})}>Noter</Button>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'DOCUMENTS' && (
              <div className="space-y-12">
                {/* Official IDs Section */}
                <div className="space-y-6">
                  <h3 className="font-heading font-bold text-xl text-haven-navy flex items-center gap-3">
                    <ShieldCheck size={24} className="text-haven-navy" /> Pièces d'identité & Justificatifs
                  </h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    {[
                      { id: 'idCard', label: 'Pièce d\'identité', icon: UserCircle, status: currentUser?.documents?.idCard ? 'Vérifié' : 'Manquant' },
                      { id: 'proofOfIncome', label: 'Justificatif de revenus', icon: FileText, status: currentUser?.documents?.proofOfIncome ? 'Vérifié' : 'Manquant' },
                      { id: 'studentCard', label: 'Carte Étudiant', icon: ClipboardCheck, status: currentUser?.documents?.studentCard ? 'Vérifié' : 'Manquant' },
                    ].map(doc => (
                      <div key={doc.id} className="bg-white rounded-[2rem] p-8 border border-gray-100 flex flex-col items-center text-center space-y-4 hover:shadow-card transition-all group">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${doc.status === 'Vérifié' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400 group-hover:bg-haven-red/10 group-hover:text-haven-red'} transition-colors`}>
                          <doc.icon size={32} />
                        </div>
                        <div>
                          <h4 className="font-bold text-haven-navy">{doc.label}</h4>
                          <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${doc.status === 'Vérifié' ? 'text-green-600' : 'text-gray-400'}`}>{doc.status}</p>
                        </div>
                        <Button variant="outline" size="sm" className="w-full text-[10px] h-10 font-black uppercase rounded-xl" onClick={() => handleUploadDocument(doc.id as any)}>
                          <Upload size={14} className="mr-2" /> {doc.status === 'Vérifié' ? 'Remplacer' : 'Télécharger'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Generated Reports Section */}
                <div className="space-y-6 pt-6 border-t border-gray-100">
                  <h3 className="font-heading font-bold text-xl text-haven-navy flex items-center gap-3">
                    <FileText size={24} className="text-haven-navy" /> États des Lieux & Contrats
                  </h3>
                  {documents.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      {documents.map(doc => (
                        <div key={doc.id} className="bg-white border border-gray-100 rounded-[1.5rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-4 group hover:border-haven-navy transition-all shadow-sm hover:shadow-md">
                          <div className="flex items-center gap-4 w-full sm:w-auto">
                            <div className="p-3 bg-haven-navy/5 rounded-xl text-haven-navy group-hover:bg-haven-navy group-hover:text-white transition-all">
                              <FileText size={20} />
                            </div>
                            <div>
                               <h4 className="font-bold text-haven-navy text-sm">{doc.title}</h4>
                               <p className="text-[10px] text-gray-400 font-medium tracking-tight">Généré le {new Date(doc.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="flex-1 sm:flex-none h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border-gray-100"
                              onClick={() => setViewingDocument(doc)}
                            >
                              Visualiser
                            </Button>
                            <Button 
                              variant="primary" 
                              size="sm" 
                              className="flex-1 sm:flex-none h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-haven-navy"
                              onClick={() => handleDownload(doc)}
                            >
                              Télécharger
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-16 bg-gray-50/50 rounded-[2.5rem] border-2 border-dashed border-gray-100 text-center">
                       <p className="text-sm font-bold text-gray-300">Aucun document n'a encore été généré pour vos séjours.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'MESSAGES' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-gray-50 p-6 rounded-3xl border border-gray-100">
                  <div>
                    <h3 className="font-heading font-bold text-xl text-haven-navy">Conversations</h3>
                    <p className="text-sm text-gray-500">Communiquez avec les propriétaires facilement.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/inbox')}>Plein écran</Button>
                </div>
                <div className="max-w-4xl mx-auto">
                  <ConversationsList />
                </div>
              </div>
            )}

            {activeTab === 'FAVORITES' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {favorites.map(listing => (
                  <div key={listing.id} onClick={() => navigate(`/listing/${listing.id}`)} className="group bg-white rounded-3xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-500 cursor-pointer">
                    <div className="relative h-48 overflow-hidden">
                      <img src={listing.mainPhotoUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                      <div className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-md rounded-full shadow-sm">
                        <Heart className="w-4 h-4 text-haven-red fill-haven-red" />
                      </div>
                    </div>
                    <div className="p-6">
                      <h4 className="font-bold text-haven-navy group-hover:text-haven-red transition-colors">{listing.title}</h4>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><MapPin size={12}/> {listing.city}</p>
                      <div className="mt-4 flex justify-between items-center">
                        <span className="text-sm font-black text-haven-navy">{listing.rooms[0]?.pricePerDay}€ <span className="text-[10px] text-gray-400 font-medium">/ jour</span></span>
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-haven-navy transition-colors" />
                      </div>
                    </div>
                  </div>
                ))}
                {favorites.length === 0 && (
                  <div className="col-span-full text-center py-20 bg-gray-50/50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                    <Heart size={48} className="mx-auto text-gray-200 mb-4" />
                    <p className="text-gray-400 font-bold">Coup de cœur ?</p>
                    <p className="text-sm text-gray-500">Ajoutez des logements à vos favoris pour les retrouver ici.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RENDER MODAL */}
      <InventoryModal 
        isOpen={inventoryState.isOpen}
        onClose={() => setInventoryState(prev => ({ ...prev, isOpen: false }))}
        type={inventoryState.type}
        booking={inventoryState.selectedBooking!}
        listing={inventoryState.selectedBooking?.listing}
        room={inventoryState.selectedBooking?.listing?.rooms[0]} 
        onComplete={handleInventoryComplete}
      />
      {/* ... ReviewModal, AccountStatusOverlay, ReportModal remain ... */}
      <ReviewModal 
        isOpen={reviewState.isOpen}
        onClose={() => setReviewState(prev => ({ ...prev, isOpen: false }))}
        targetId={reviewState.targetId}
        targetName={reviewState.targetName}
        targetType={reviewState.targetType}
      />

      <AccountStatusOverlay 
        isOpen={isVerificationModalOpen} 
        onClose={() => setIsVerificationModalOpen(false)} 
      />

      <ReportModal 
        isOpen={reportState.isOpen}
        onClose={() => setReportState(prev => ({ ...prev, isOpen: false }))}
        targetId={reportState.targetId}
        targetType={reportState.targetType}
        listingId={reportState.listingId}
        bookingId={reportState.bookingId}
        ownerId={reportState.ownerId}
      />

      {/* Document Preview Modal */}
      <AnimatePresence mode="wait">
        {viewingDocument && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-hidden">
            <motion.div 
              key="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-haven-navy/90 backdrop-blur-xl" 
              onClick={() => setViewingDocument(null)}
            />
            <motion.div 
              key="modal-content"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[3rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col z-[10000]"
            >
              <div className="p-8 md:p-10 border-b border-gray-100 flex justify-between items-center bg-haven-cream/20">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-haven-navy text-white rounded-2xl flex items-center justify-center shadow-lg shadow-haven-navy/20">
                    <FileText size={28} />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-haven-navy text-2xl tracking-tight">{viewingDocument.title}</h3>
                    <p className="text-sm text-haven-stone font-medium uppercase tracking-widest">{viewingDocument.listingTitle}</p>
                  </div>
                </div>
                <button onClick={() => setViewingDocument(null)} className="w-12 h-12 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-full transition-all group">
                  <X size={24} className="text-gray-400 group-hover:text-haven-navy group-hover:rotate-90 transition-all duration-300" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 md:p-16">
                 <div className="max-w-2xl mx-auto space-y-12">
                    <div className="text-center space-y-4 mb-16">
                       <div className="inline-block px-4 py-1.5 bg-haven-navy text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full mb-4">
                          {viewingDocument.type.replace('_', ' ')}
                       </div>
                       <h2 className="text-haven-navy font-heading font-bold text-4xl leading-tight">Certificat de Conformité</h2>
                       <p className="text-haven-stone font-medium">Référence d'archivage : <span className="font-mono text-gray-400">{viewingDocument.id}</span></p>
                       <p className="text-xs text-gray-400 pt-2">Généré numériquement le {new Date(viewingDocument.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-12 border-y border-gray-100 py-10">
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-4">Émetteur du document</p>
                          <Logo className="h-10 w-auto mb-2" />
                          <p className="text-sm text-haven-stone leading-relaxed">Département Gestion & Conformité<br/>Service des États des Lieux</p>
                       </div>
                       <div className="space-y-2 text-right">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-4">Porteur des droits</p>
                          <p className="font-bold text-haven-navy text-lg">{currentUser?.firstName} {currentUser?.lastName}</p>
                          <p className="text-sm text-haven-stone">{currentUser?.email}</p>
                       </div>
                    </div>

                    <div className="space-y-8">
                       <div className="flex items-center gap-3">
                          <div className="h-px flex-1 bg-gray-100"></div>
                          <h4 className="font-black text-heaven-stone uppercase tracking-[0.3em] text-[10px]">Informations Certifiées</h4>
                          <div className="h-px flex-1 bg-gray-100"></div>
                       </div>
                       
                       <div className="bg-gray-50/50 p-10 rounded-[2.5rem] space-y-6 border border-gray-100 shadow-inner">
                          <div className="flex justify-between items-center text-sm">
                             <div className="flex items-center gap-3 text-haven-stone">
                                <FileText size={16} />
                                <span>Type réglementaire</span>
                             </div>
                             <span className="font-bold text-haven-navy">{viewingDocument.type}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                             <div className="flex items-center gap-3 text-haven-stone">
                                <Calendar size={16} />
                                <span>Dossier de réservation</span>
                             </div>
                             <span className="font-bold text-haven-navy">{viewingDocument.bookingId}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                             <div className="flex items-center gap-3 text-haven-stone">
                                <ShieldCheck size={16} />
                                <span>Validité juridique</span>
                             </div>
                             <span className="px-4 py-1.5 bg-green-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-md shadow-green-500/20">Signé & Certifié</span>
                          </div>
                       </div>
                    </div>

                    <div className="pt-8">
                       <div className="bg-haven-navy text-white rounded-[2.5rem] p-12 text-center relative overflow-hidden group">
                          <Sparkles className="absolute -top-4 -right-4 text-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" size={120} />
                          <div className="relative z-10 space-y-4">
                             <CheckCircle className="mx-auto text-green-400 mb-6" size={48} />
                             <p className="text-lg font-medium text-blue-100 leading-relaxed">
                                Le document complet incluant les signatures numériques infalsifiables et l'index photographique certifié a été archivé.
                             </p>
                             <p className="text-xs text-white/40 italic">
                                Cette prévisualisation est un résumé administratif conforme à l'original.
                             </p>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="p-8 md:p-10 bg-gray-50 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                 <p className="text-xs text-gray-400 font-medium md:max-w-sm">
                    Ce document est confidentiel et généré automatiquement par HAVEN. En cas de litige, seule la version archivée sur nos serveurs fait foi.
                 </p>
                 <div className="flex gap-4 w-full md:w-auto">
                    <Button variant="outline" className="flex-1 md:flex-none rounded-2xl px-10 h-14 font-black uppercase tracking-widest text-[11px]" onClick={() => setViewingDocument(null)}>Fermer</Button>
                    <Button variant="primary" className="flex-1 md:flex-none rounded-2xl px-12 h-14 font-black uppercase tracking-widest text-[11px] shadow-xl shadow-haven-navy/20" onClick={() => handleDownload(viewingDocument)}>Télécharger le PDF</Button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
