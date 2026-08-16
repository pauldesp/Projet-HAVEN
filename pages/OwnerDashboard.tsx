import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { 
  Plus, 
  Home, 
  Calendar, 
  TrendingUp, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ChevronRight, 
  MoreHorizontal, 
  Loader2, 
  DollarSign, 
  BarChart3, 
  MessageSquare, 
  AlertTriangle, 
  ArrowRightLeft,
  Search,
  Filter,
  Download,
  Eye,
  ShieldCheck,
  Star,
  Wallet,
  Edit,
  MapPin,
  MessageCircle,
  Inbox
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useListings } from '../contexts/ListingContext';
import { apiService } from '../services/api';
import { Booking, Listing, UserRole, Incident, Payment, User } from '../types';
import { AccountStatusOverlay } from '../components/AccountStatusOverlay';
import { ConversationsList } from '../components/ConversationsList';
import { toast } from 'sonner';

interface BookingWithTenant extends Booking {
  tenant: User;
}

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
        setTimeLeft(`⚠️ Expire dans ${hours}h ${minutes}m ${seconds}s`);
      } else if (booking.status === 'APPROVED' && booking.approvedAt) {
        const limit = new Date(new Date(booking.approvedAt).getTime() + 72 * 60 * 60 * 1000);
        const diff = limit.getTime() - now.getTime();
        if (diff <= 0) {
          setTimeLeft('Délai de paiement expiré');
          setIsExpired(true);
          return;
        }
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`⏳ Reste ${hours}h ${minutes}m pour régler`);
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
          : 'bg-blue-50 text-blue-600 border border-blue-100'
    }`}>
      {timeLeft}
    </div>
  );
};

export const OwnerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, refreshUser, updateUserRole } = useAuth();
  const { listings } = useListings();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LISTINGS' | 'BOOKINGS' | 'MESSAGES' | 'FINANCES' | 'INCIDENTS'>('OVERVIEW');
  const [ownerBookings, setOwnerBookings] = useState<BookingWithTenant[]>([]);
  const [ownerIncidents, setOwnerIncidents] = useState<Incident[]>([]);
  const [ownerPayments, setOwnerPayments] = useState<Payment[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [bookingSubTab, setBookingSubTab] = useState<'UPCOMING' | 'CURRENT' | 'PAST'>('UPCOMING');

  const ownerListings = listings.filter(l => l.ownerId === currentUser?.id);
  const isApproved = currentUser?.status === 'APPROVED';

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribeMessages = apiService.messages.listenToConversations(currentUser.id, (convs) => {
      const totalUnread = convs.reduce((acc, curr) => acc + curr.unreadCount, 0);
      setUnreadCount(totalUnread);
    });

    const fetchData = async () => {
      if (!currentUser) return;
      setIsLoading(true);
      try {
        // Fetch Bookings
        const bookings = await apiService.bookings.getByOwnerId(currentUser.id);
        const tenantIds = Array.from(new Set(bookings.map(b => b.tenantId)));
        const tenants = await apiService.users.getByIds(tenantIds);
        const tenantMap = new Map(tenants.map(t => [t.id, t]));
        
        const enrichedBookings = bookings.map(b => ({
          ...b,
          tenant: tenantMap.get(b.tenantId) as User || { 
            id: b.tenantId, 
            firstName: 'Utilisateur', 
            lastName: 'Inconnu', 
            avatarUrl: '',
            email: '',
            role: 'TENANT' as UserRole
          }
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
        
        setOwnerBookings(sortedBookings);

        // Fetch incidents for all owner listings
        const incidents = await apiService.incidents.getByOwnerId(currentUser.id);
        setOwnerIncidents(incidents);

        // Fetch payments
        const payments = await apiService.payments.getByOwnerId(currentUser.id);
        setOwnerPayments(payments);

      } catch (e) {
        console.error("Error fetching owner data", e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    return () => {
      unsubscribeMessages();
    };
  }, [currentUser, listings]);

  const handleSwitchToTenant = async () => {
    if (!currentUser) return;
    try {
      await updateUserRole(UserRole.TENANT);
      navigate('/dashboard');
    } catch (e) {
      console.error("Error switching to tenant", e);
    }
  };

  const handleBookingStatus = async (bookingId: string, status: Booking['status']) => {
    try {
      await apiService.bookings.updateStatus(bookingId, status);
      
      // Send notification emails (Chantier 3)
      const booking = ownerBookings.find(b => b.id === bookingId);
      if (booking && booking.tenant && booking.tenant.email) {
        const listing = listings.find(l => l.id === booking.listingId);
        const listingTitle = listing?.title || "Logement HAVEN";
        
        if (status === 'APPROVED') {
          try {
            await apiService.notifications.sendBookingNotification(
              booking.tenant.email,
              'REQUEST_APPROVED',
              {
                listingTitle,
                roomName: booking.roomName || 'Chambre',
                amount: booking.totalPrice,
                startDate: new Date(booking.startDate).toLocaleDateString('fr-FR'),
                endDate: new Date(booking.endDate).toLocaleDateString('fr-FR'),
                tenantName: `${booking.tenant.firstName} ${booking.tenant.lastName}`,
                ownerName: `${currentUser?.firstName} ${currentUser?.lastName}`,
                bookingId
              }
            );
          } catch (emailErr) {
            console.error("Failed to send approval email", emailErr);
          }
        } else if (status === 'CANCELLED') {
          try {
            await apiService.notifications.sendBookingNotification(
              booking.tenant.email,
              'BOOKING_CANCELLED',
              {
                listingTitle,
                roomName: booking.roomName || 'Chambre',
                amount: booking.totalPrice,
                startDate: new Date(booking.startDate).toLocaleDateString('fr-FR'),
                endDate: new Date(booking.endDate).toLocaleDateString('fr-FR'),
                tenantName: `${booking.tenant.firstName} ${booking.tenant.lastName}`,
                ownerName: `${currentUser?.firstName} ${currentUser?.lastName}`,
                bookingId
              }
            );
          } catch (emailErr) {
            console.error("Failed to send cancellation email", emailErr);
          }
        }
      }

      setOwnerBookings(prev => prev.map(b => b.id === bookingId ? { 
        ...b, 
        status,
        ...(status === 'APPROVED' ? { approvedAt: new Date().toISOString() } : {})
      } : b));
      if (status === 'APPROVED') {
        toast.success("Demande acceptée ! Le locataire a maintenant 72h pour régler.");
      } else if (status === 'CANCELLED') {
        toast.error("La demande a été refusée.");
      } else if (status === 'CONFIRMED') {
        toast.success("La réservation a été confirmée.");
      }
    } catch (e) {
      console.error("Error updating booking status", e);
      toast.error("Erreur lors de la modification du statut.");
    }
  };

  const handlePublishClick = () => {
    if (!currentUser) {
      navigate('/login?redirect=/owner/publish&role=OWNER');
    } else if (currentUser.role !== UserRole.OWNER && currentUser.role !== UserRole.ADMIN) {
      navigate('/login?redirect=/owner/publish&role=OWNER');
    } else if (currentUser.status !== 'APPROVED') {
      setIsVerificationModalOpen(true);
    } else {
      navigate('/owner/publish');
    }
  };

  const stats = {
    totalRevenue: ownerPayments.reduce((acc, p) => acc + p.amount, 0),
    pendingRevenue: ownerBookings
      .filter(b => b.status === 'CONFIRMED' && new Date(b.startDate) > new Date())
      .reduce((acc, b) => acc + b.totalPrice, 0),
    activeBookings: ownerBookings.filter(b => b.status === 'CONFIRMED').length,
    pendingRequests: ownerBookings.filter(b => b.status === 'PENDING').length,
    openIncidents: ownerIncidents.filter(i => i.status !== 'RESOLVED').length
  };

  const now = new Date();
  
  const upcomingBookings = ownerBookings.filter(b => {
    if (b.status === 'PENDING' || b.status === 'APPROVED') return true;
    const start = new Date(b.startDate);
    return start.getTime() > now.getTime();
  });
  
  const currentBookings = ownerBookings.filter(b => {
    const start = new Date(b.startDate);
    const end = new Date(b.endDate);
    return start.getTime() <= now.getTime() && end.getTime() >= now.getTime();
  });
  
  const pastBookings = ownerBookings.filter(b => {
    const end = new Date(b.endDate);
    return end.getTime() < now.getTime();
  });

  const displayedBookings = bookingSubTab === 'UPCOMING' ? upcomingBookings :
                            bookingSubTab === 'CURRENT' ? currentBookings : pastBookings;

  if (isLoading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-haven-navy"/></div>;

  return (
    <div className="min-h-screen bg-haven-cream pb-20 font-body">
      <div className="bg-haven-navy pt-12 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="font-heading font-bold text-3xl text-white mb-2 tracking-tight">
              Espace Propriétaire
            </h1>
            <div className="flex items-center gap-4">
              <p className="text-blue-200 font-medium">Gérez votre patrimoine et suivez vos performances.</p>
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
              onClick={handleSwitchToTenant}
            >
              <ArrowRightLeft size={16} /> Passer en mode locataire
            </Button>
            <Button 
              variant="primary" 
              size="sm" 
              className="bg-haven-red hover:bg-haven-red/90 border-none px-6 flex items-center gap-2"
              onClick={handlePublishClick}
            >
              <Plus size={18} /> Ajouter un logement
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16">
        {/* Verification Banner */}
        {!isApproved && (
          <div className="mb-8 bg-orange-50 border border-orange-100 rounded-[2.5rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="font-bold text-haven-navy">Vérification d'identité requise</h4>
                <p className="text-sm text-gray-500">Vous devez valider votre identité pour publier de nouvelles annonces.</p>
              </div>
            </div>
            <Button 
              variant="primary" 
              size="sm" 
              className="bg-orange-500 hover:bg-orange-600 border-none px-8"
              onClick={() => setIsVerificationModalOpen(true)}
            >
              Vérifier mon identité
            </Button>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Revenus Totaux', value: `${stats.totalRevenue}€`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Virements en attente', value: `${stats.pendingRevenue}€`, icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Demandes en attente', value: stats.pendingRequests, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Sinistres ouverts', value: stats.openIncidents, icon: AlertTriangle, color: 'text-haven-red', bg: 'bg-red-50' },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-[2rem] shadow-premium border border-gray-50 flex items-center gap-4">
              <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-gray-400">{stat.label}</p>
                <p className="text-xl font-bold text-haven-navy">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-premium p-8 min-h-[500px] border border-gray-50">
          <div className="flex flex-wrap gap-4 md:gap-8 border-b border-gray-100 mb-8 overflow-x-auto">
            {[
              { id: 'OVERVIEW', label: 'Vue d\'ensemble', icon: Home },
              { id: 'LISTINGS', label: 'Mes Logements', icon: Home },
              { id: 'BOOKINGS', label: 'Réservations', icon: Calendar },
              { id: 'MESSAGES', label: 'Messages', icon: Inbox },
              { id: 'FINANCES', label: 'Finances', icon: DollarSign },
              { id: 'INCIDENTS', label: 'Sinistres', icon: AlertTriangle },
            ].map(tab => (
              <button 
                key={tab.id}
                className={`pb-4 font-bold text-sm transition-all relative flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'text-haven-navy' : 'text-gray-300 hover:text-gray-500'}`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                <tab.icon size={16} />
                {tab.label}
                {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-haven-navy rounded-full animate-fade-in" />}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {activeTab === 'OVERVIEW' && (
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="font-heading font-bold text-xl text-haven-navy flex items-center gap-2">
                    <TrendingUp size={20} className="text-haven-red" /> Activité Récente
                  </h3>
                  <div className="space-y-4">
                    {ownerBookings.slice(0, 5).map(booking => (
                      <div key={booking.id} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-haven-navy shadow-sm">
                          <Users size={20} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-haven-navy">Nouvelle demande de réservation</p>
                          <p className="text-xs text-gray-500">De {booking.tenant.firstName} pour votre logement à {listings.find(l => l.id === booking.listingId)?.city}</p>
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase">{new Date(booking.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                    {ownerBookings.length === 0 && (
                      <p className="text-gray-400 text-center py-4">Aucune activité récente.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-6">
                  <h3 className="font-heading font-bold text-xl text-haven-navy flex items-center gap-2">
                    <MessageSquare size={20} className="text-haven-red" /> {unreadCount > 0 ? 'Urgent : Messages' : 'Messages'}
                  </h3>
                  <div 
                    onClick={() => setActiveTab('MESSAGES')}
                    className={`rounded-[2.5rem] p-8 text-center border transition-all duration-500 cursor-pointer shadow-sm hover:shadow-xl ${unreadCount > 0 ? 'bg-haven-red/5 border-haven-red/20 ring-4 ring-haven-red/5' : 'bg-gray-50 border-gray-100'}`}
                  >
                    <div className="relative inline-block">
                      <MessageSquare size={48} className={`mx-auto mb-4 ${unreadCount > 0 ? 'text-haven-red' : 'text-gray-200'}`} />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-haven-red text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-bounce">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <p className={`font-bold text-lg ${unreadCount > 0 ? 'text-haven-red' : 'text-haven-navy'}`}>
                      {unreadCount > 0 ? `${unreadCount} nouveau${unreadCount > 1 ? 'x' : ''} message${unreadCount > 1 ? 's' : ''}` : 'Aucun nouveau message'}
                    </p>
                    <p className={`text-sm mt-2 font-medium ${unreadCount > 0 ? 'text-haven-navy' : 'text-gray-400'}`}>
                      {unreadCount > 0 ? 'Vos locataires attendent une réponse.' : "Votre messagerie est à jour."}
                    </p>
                    <Button variant="ghost" size="sm" className="mt-6 text-[10px] font-black uppercase tracking-widest text-haven-navy underline-offset-4 hover:underline">
                      Accéder à la messagerie
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'LISTINGS' && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ownerListings.map(listing => (
                  <div key={listing.id} className="group bg-white rounded-3xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all duration-500">
                    <div className="relative h-48 overflow-hidden">
                      <img src={listing.mainPhotoUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                      <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-[10px] font-black uppercase backdrop-blur-md ${
                        listing.status === 'APPROVED' ? 'bg-green-500/90 text-white' : 
                        listing.status === 'PENDING' ? 'bg-orange-500/90 text-white' : 'bg-red-500/90 text-white'
                      }`}>
                        {listing.status === 'APPROVED' ? 'En ligne' : listing.status === 'PENDING' ? 'En attente' : 'Refusé'}
                      </div>
                    </div>
                    <div className="p-6">
                      <h4 className="font-bold text-haven-navy group-hover:text-haven-red transition-colors">{listing.title}</h4>
                      <div className="mt-4 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-gray-400 text-xs font-bold">
                          <Users size={14} /> {ownerBookings.filter(b => b.listingId === listing.id && b.status === 'CONFIRMED').length} locataires
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" className="rounded-xl hover:bg-gray-100" onClick={() => navigate(`/listing/${listing.id}`)}><Eye size={18} /></Button>
                          <Button size="sm" variant="ghost" className="rounded-xl hover:bg-gray-100" onClick={() => navigate(`/owner/edit/${listing.id}`)}><Edit size={18} /></Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {ownerListings.length === 0 && (
                  <div className="col-span-full text-center py-20 bg-gray-50 rounded-[2.5rem] border border-dashed border-gray-200">
                    <Home size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="font-bold text-gray-400">Vous n'avez pas encore de logements.</p>
                    <Button variant="primary" className="mt-4" onClick={handlePublishClick}>Publier ma première annonce</Button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'BOOKINGS' && (
              <div className="space-y-6">
                {/* Sub-tabs for bookings */}
                <div className="flex flex-wrap gap-2 p-1.5 bg-gray-100 rounded-2xl w-full max-w-md">
                  {[
                    { id: 'UPCOMING', label: 'À venir', count: upcomingBookings.length },
                    { id: 'CURRENT', label: 'En ce moment', count: currentBookings.length },
                    { id: 'PAST', label: 'Passées', count: pastBookings.length }
                  ].map(subTab => (
                    <button
                      key={subTab.id}
                      onClick={() => setBookingSubTab(subTab.id as any)}
                      className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        bookingSubTab === subTab.id
                          ? 'bg-white text-haven-navy shadow-sm font-extrabold'
                          : 'text-gray-500 hover:text-haven-navy hover:bg-white/50'
                      }`}
                    >
                      <span>{subTab.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        bookingSubTab === subTab.id
                          ? 'bg-haven-navy text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {subTab.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Locataire</th>
                        <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Logement</th>
                        <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Dates</th>
                        <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Statut</th>
                        <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {displayedBookings.map(booking => (
                        <tr key={booking.id} className="group hover:bg-gray-50/50 transition-colors">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-haven-navy/10 rounded-full overflow-hidden flex items-center justify-center">
                                <img src={booking.tenant.avatarUrl} className="w-full h-full object-cover" alt="" />
                              </div>
                              <span className="text-sm font-bold text-haven-navy">{booking.tenant.firstName} {booking.tenant.lastName}</span>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className="text-sm font-medium text-gray-600">{listings.find(l => l.id === booking.listingId)?.title}</span>
                          </td>
                          <td className="py-4">
                            <span className="text-xs font-bold text-haven-navy">
                              {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                              booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-600' :
                              booking.status === 'APPROVED' ? 'bg-blue-100 text-blue-600' :
                              booking.status === 'PENDING' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
                            }`}>
                              {booking.status === 'CONFIRMED' ? 'Confirmé' : 
                               booking.status === 'APPROVED' ? 'Accepté (Attente paiement)' :
                               booking.status === 'PENDING' ? 'En attente' : 'Annulé'}
                            </span>
                            <BookingCountdown booking={booking} />
                          </td>
                          <td className="py-4 text-right">
                            {booking.status === 'PENDING' ? (
                              <div className="flex justify-end gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-green-600 border-green-100 hover:bg-green-50 flex items-center gap-1.5 font-bold" 
                                  onClick={() => handleBookingStatus(booking.id, 'APPROVED')}
                                >
                                  <CheckCircle size={14} /> Accepter (48h)
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-haven-red border-red-100 hover:bg-red-50 flex items-center gap-1.5 font-bold" 
                                  onClick={() => handleBookingStatus(booking.id, 'CANCELLED')}
                                >
                                  <XCircle size={14} /> Refuser
                                </Button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <Link to={`/messages/${booking.id}`}>
                                  <Button size="sm" variant="ghost" className="text-haven-navy"><MessageCircle size={16} /></Button>
                                </Link>
                                <Button size="sm" variant="ghost" className="text-gray-400"><MoreHorizontal size={16} /></Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {displayedBookings.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-gray-400">Aucune réservation dans cette catégorie pour le moment.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'MESSAGES' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-gray-50 p-6 rounded-3xl border border-gray-100">
                  <div>
                    <h3 className="font-heading font-bold text-xl text-haven-navy">Centre de Messagerie</h3>
                    <p className="text-sm text-gray-500">Communiquez avec vos locataires en toute sécurité.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/inbox')}>Voir en plein écran</Button>
                </div>
                <div className="max-w-4xl mx-auto">
                  <ConversationsList />
                </div>
              </div>
            )}

            {activeTab === 'FINANCES' && (
              <div className="space-y-8">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-haven-navy rounded-3xl p-8 text-white min-h-[160px] flex flex-col justify-center">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Revenus encaissés</p>
                    <p className="text-4xl font-bold mt-2">{stats.totalRevenue}€</p>
                    <p className="text-xs text-blue-200 mt-4 leading-relaxed italic opacity-80">
                      Virés sur votre compte bancaire.
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-3xl p-8 border border-blue-100 flex flex-col justify-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Virements en attente</p>
                    <p className="text-3xl font-bold text-haven-navy mt-2">{stats.pendingRevenue}€</p>
                    <p className="text-xs text-gray-500 mt-4 italic">
                      Locataires ayant réservé mais pas encore arrivés.
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 flex flex-col justify-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Paiements sécurisés</p>
                    <p className="text-xl font-bold text-haven-navy mt-2 flex items-center gap-2">
                      <ShieldCheck className="text-green-500" size={24} /> Validés
                    </p>
                    <p className="text-xs text-gray-500 mt-4">
                      Aucun risque d'impayé.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-heading font-bold text-xl text-haven-navy">Historique des transactions</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Date</th>
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Description</th>
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Montant</th>
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {ownerPayments.map(payment => (
                          <tr key={payment.id}>
                            <td className="py-4 text-sm text-gray-600">{new Date(payment.createdAt).toLocaleDateString()}</td>
                            <td className="py-4 text-sm font-bold text-haven-navy">Loyer - {listings.find(l => l.id === payment.listingId)?.title}</td>
                            <td className="py-4 text-sm font-black text-green-600">+{payment.amount}€</td>
                            <td className="py-4">
                              <span className="px-3 py-1 rounded-full bg-green-100 text-green-600 text-[10px] font-black uppercase">Versé</span>
                            </td>
                          </tr>
                        ))}
                        {ownerPayments.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-12 text-center text-gray-400">Aucune transaction enregistrée.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'INCIDENTS' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-heading font-bold text-xl text-haven-navy">Sinistres et Incidents</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex items-center gap-2"><Filter size={14}/> Filtrer</Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-2"><Download size={14}/> Exporter</Button>
                  </div>
                </div>

                <div className="grid gap-4">
                  {ownerIncidents.map(incident => (
                    <div key={incident.id} className="bg-white border border-gray-100 rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center hover:shadow-card transition-all">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                        incident.status === 'RESOLVED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-haven-red'
                      }`}>
                        <AlertTriangle size={24} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-bold text-haven-navy">{incident.title}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                            incident.priority === 'HIGH' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                          }`}>
                            {incident.priority}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-1">{incident.description}</p>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-widest">
                          {listings.find(l => l.id === incident.listingId)?.title} • Signalé le {new Date(incident.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <Button variant="outline" size="sm" className="flex-1 md:flex-none">Détails</Button>
                        <Button variant="primary" size="sm" className="flex-1 md:flex-none">Gérer</Button>
                      </div>
                    </div>
                  ))}

                  {ownerIncidents.length === 0 && (
                    <div className="text-center py-20 bg-gray-50 rounded-[2.5rem] border border-dashed border-gray-200">
                      <CheckCircle size={48} className="mx-auto text-green-200 mb-4" />
                      <p className="font-bold text-gray-400">Aucun incident signalé sur vos logements.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AccountStatusOverlay 
        isOpen={isVerificationModalOpen} 
        onClose={() => setIsVerificationModalOpen(false)} 
      />
    </div>
  );
};
