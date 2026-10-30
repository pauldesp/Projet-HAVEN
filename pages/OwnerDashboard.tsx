import { OwnerPayoutSettings } from '../components/OwnerPayoutSettings';
import { OwnerBookingActions } from '../components/OwnerBookingActions';
import { OwnerRecentActivity } from '../components/OwnerRecentActivity';
import { BookingCountdown } from '../components/BookingCountdown';
import { bookingCategory } from '../services/bookingLifecycle';
import { hasVerificationException } from '../services/verificationException';
import { hasRequiredPhoneNumber, isVerificationPending } from '../services/profileVerification';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { OwnerIncidentDetail, incidentStatusLabel } from '../components/OwnerIncidentDetail';
import { Button } from '../components/Button';
import { Plus, Home, Calendar, TrendingUp, CheckCircle, Clock, Loader2, DollarSign, MessageSquare, AlertTriangle, ArrowRightLeft, Filter, Download, Eye, ShieldCheck, Wallet, Edit, MessageCircle, Inbox, FileText, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useListings } from '../contexts/ListingContext';
import { apiService } from '../services/api';
import { Booking, UserRole, Incident, Payment, OwnerPayout, User } from '../types';
import { AccountStatusOverlay } from '../components/AccountStatusOverlay';
import { ConversationsList } from '../components/ConversationsList';
import { CancellationModal } from '../components/CancellationModal';
import { toast } from 'sonner';
import { calculateOwnerFinanceStats, realOwnerPayouts, ownerPayoutStatusLabel } from '../services/ownerFinances';

interface BookingWithTenant extends Booking {
  tenant: User;
}

export const OwnerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, updateUserRole } = useAuth();
  const { listings } = useListings();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LISTINGS' | 'BOOKINGS' | 'MESSAGES' | 'FINANCES' | 'DOCUMENTS' | 'INCIDENTS'>(searchParams.has('stripe') ? 'FINANCES' : 'OVERVIEW');
  const [ownerBookings, setOwnerBookings] = useState<BookingWithTenant[]>([]);
  const [ownerIncidents, setOwnerIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [incidentError, setIncidentError] = useState('');
  const selectedIncident = ownerIncidents.find(item => item.id === selectedIncidentId);
  const [ownerPayments, setOwnerPayments] = useState<Payment[]>([]);
  const [ownerPayouts, setOwnerPayouts] = useState<OwnerPayout[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [payoutError, setPayoutError] = useState('');
  const money = (amount: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  useEffect(() => {
    let active = true;
    setOwnerPayouts([]); setPayoutLoading(true); setPayoutError('');
    if (!currentUser?.id) return;
    const load = async () => {
      try { const payouts = await apiService.ownerPayouts.getMine(); if (active) { setOwnerPayouts(payouts); setPayoutError(''); } }
      catch { if (active) setPayoutError('Les virements sont momentanément indisponibles.'); }
      finally { if (active) setPayoutLoading(false); }
    };
    void load(); const timer = setInterval(load, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [currentUser?.id]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [cancellationBooking, setCancellationBooking] = useState<BookingWithTenant | null>(null);
  const [bookingSubTab, setBookingSubTab] = useState<'UPCOMING' | 'CURRENT' | 'PAST'>('UPCOMING');

  const ownerListings = listings.filter(l => l.ownerId === currentUser?.id);
  const isApproved = Boolean(currentUser && hasVerificationException(currentUser)) || (currentUser?.status === 'APPROVED' && currentUser.emailVerified === true && hasRequiredPhoneNumber(currentUser) && currentUser.identityVerified === true) || currentUser?.role === UserRole.ADMIN;
  const isSubmittedForReview = Boolean(currentUser && isVerificationPending(currentUser));
  const hasOwnerDocuments = Boolean(currentUser?.documents?.idCard);
  const canPublish = isApproved && (hasOwnerDocuments || Boolean(currentUser && hasVerificationException(currentUser)));

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribeMessages = apiService.messages.listenToConversations(currentUser.id, (convs) => {
      const totalUnread = convs.reduce((acc, curr) => acc + curr.unreadCount, 0);
      setUnreadCount(totalUnread);
    });

    let loadVersion = 0;
    const fetchData = async (bookings: Booking[]) => {
      const version = ++loadVersion;
      if (!currentUser) return;
      setIsLoading(true);
      try {
        // Fetch Bookings

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
        
        if (version !== loadVersion) return;
        setOwnerBookings(sortedBookings);


        // Fetch payments
        const payments = await apiService.payments.getByOwnerId(currentUser.id);
        setOwnerPayments(payments);

      } catch (e) {
        console.error("Error fetching owner data", e);
      } finally {
        setIsLoading(false);
      }
    };

    const unsubscribeBookings = apiService.bookings.listenByParticipant(currentUser.id, 'OWNER', bookings => void fetchData(bookings), () => {
      setIsLoading(false); toast.error('Impossible de charger les réservations. Actualisez la page.');
    });
    return () => {
      loadVersion++;
      unsubscribeBookings();
      unsubscribeMessages();
    };
  }, [currentUser, listings]);

  useEffect(() => {
    setOwnerIncidents([]); setIncidentError(''); setSelectedIncidentId(null);
    if (!currentUser?.id) return;
    return apiService.incidents.listenByOwnerId(currentUser.id, setOwnerIncidents,
      () => setIncidentError('Impossible de charger les incidents. Actualisez la page pour réessayer.'));
  }, [currentUser?.id]);

  const handleSwitchToTenant = async () => {
    if (!currentUser) return;
    try {
      await updateUserRole(UserRole.TENANT);
      navigate('/dashboard');
    } catch (e) {
      console.error("Error switching to tenant", e);
    }
  };

  const handlePublishClick = () => {
    if (!currentUser) {
      navigate('/login?redirect=/owner/publish&role=OWNER');
    } else if (currentUser.role !== UserRole.OWNER && currentUser.role !== UserRole.ADMIN) {
      navigate('/login?redirect=/owner/publish&role=OWNER');
    } else if (!canPublish) {
      setIsVerificationModalOpen(true);
    } else {
      navigate('/owner/publish');
    }
  };

  const financeStats = calculateOwnerFinanceStats(ownerPayouts);
  const stats = {
    totalRevenue: financeStats.totalRevenue,
    pendingRevenue: financeStats.pendingRevenue,
    activeBookings: ownerBookings.filter(b => b.status === 'CONFIRMED').length,
    openIncidents: ownerIncidents.filter(i => i.status === 'NEW' || i.status === 'INVESTIGATING').length
  };

  const now = new Date();
  
  const upcomingBookings = ownerBookings.filter(b => bookingCategory(b, now) === 'UPCOMING');
  const currentBookings = ownerBookings.filter(b => bookingCategory(b, now) === 'CURRENT');
  const pastBookings = ownerBookings.filter(b => bookingCategory(b, now) === 'PAST');

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
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
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
        {!canPublish && (
          <div className="mb-8 bg-orange-50 border border-orange-100 rounded-[2.5rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="font-bold text-haven-navy">{isSubmittedForReview ? 'Dossier en cours de vérification' : 'Dossier propriétaire requis'}</h4>
                <p className="text-sm text-gray-500">{isSubmittedForReview ? 'Votre dossier a été transmis à Haven. Un administrateur vérifie votre identité avant d’activer la mise en ligne.' : 'Votre pièce d’identité doit être validée avant toute mise en ligne.'}</p>
              </div>
            </div>
            <Button 
              variant="primary" 
              size="sm" 
              className="bg-orange-500 hover:bg-orange-600 border-none px-8"
              onClick={() => setIsVerificationModalOpen(true)}
            >
              {isSubmittedForReview ? 'Dossier en cours de validation' : 'Compléter mon dossier'}
            </Button>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Revenus versés', value: payoutLoading || payoutError ? '—' : money(stats.totalRevenue), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Virements en attente', value: payoutLoading || payoutError ? '—' : money(stats.pendingRevenue), icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Réservations confirmées', value: stats.activeBookings, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Sinistres ouverts', value: stats.openIncidents, icon: AlertTriangle, color: 'text-haven-red', bg: 'bg-red-50' },
          ].map((stat, i) => (
            <div key={i} className="min-w-0 bg-white p-4 lg:p-6 rounded-3xl shadow-premium border border-gray-50 flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:gap-4">
              <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-gray-400">{stat.label}</p>
                <p className="break-words text-lg lg:text-xl font-bold text-haven-navy">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        <p className={`mb-6 text-xs ${payoutError ? 'text-haven-red' : 'text-gray-500'}`} role={payoutError ? 'alert' : undefined}>{payoutError || 'Revenus et virements : seuls les versements bancaires réels sont comptabilisés. Les simulations sont exclues.'}</p>

        <div className="bg-white rounded-[2.5rem] shadow-premium p-4 sm:p-8 min-h-[500px] border border-gray-50">
          <div className="haven-tabs flex gap-4 md:gap-8 border-b border-gray-100 mb-8 overflow-x-auto">
            {[
              { id: 'OVERVIEW', label: 'Vue d\'ensemble', icon: Home },
              { id: 'LISTINGS', label: 'Mes Logements', icon: Home },
              { id: 'BOOKINGS', label: 'Réservations', icon: Calendar },
              { id: 'MESSAGES', label: 'Messages', icon: Inbox },
              { id: 'FINANCES', label: 'Finances', icon: DollarSign },
              { id: 'DOCUMENTS', label: 'Mes Documents', icon: FileText },
              { id: 'INCIDENTS', label: 'Incidents', icon: AlertTriangle },
            ].map(tab => (
              <button 
                key={tab.id}
                className={`min-h-12 pb-4 font-bold text-sm transition-all relative flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'text-haven-navy' : 'text-gray-300 hover:text-gray-500'}`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                <tab.icon size={16} />
                {tab.label}
                {tab.id === 'INCIDENTS' && stats.openIncidents > 0 && <span className="ml-1 rounded-full bg-haven-red px-2 py-0.5 text-xs text-white">{stats.openIncidents}</span>}
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
                  <OwnerRecentActivity bookings={ownerBookings} listings={listings} onView={booking => {
                    const category = bookingCategory(booking);
                    setBookingSubTab(category === 'PAST' ? 'PAST' : category === 'CURRENT' ? 'CURRENT' : 'UPCOMING');
                    setActiveTab('BOOKINGS');
                  }} />
                </div>
                <div className="space-y-6">
                  <h3 className="font-heading font-bold text-xl text-haven-navy flex items-center gap-2">
                    <MessageSquare size={20} className="text-haven-red" /> {unreadCount > 0 ? 'Urgent : Messages' : 'Messages'}
                  </h3>
                  <div 
                    onClick={() => setActiveTab('MESSAGES')}
                    className={`rounded-[2.5rem] p-4 sm:p-8 text-center border transition-all duration-500 cursor-pointer shadow-sm hover:shadow-xl ${unreadCount > 0 ? 'bg-haven-red/5 border-haven-red/20 ring-4 ring-haven-red/5' : 'bg-gray-50 border-gray-100'}`}
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
                      <div className="mt-4 flex justify-end items-center">
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
                  <table className="haven-table w-full text-left">
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
                          <td data-label="Locataire" className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-haven-navy/10 rounded-full overflow-hidden flex items-center justify-center">
                                <img src={booking.tenant.avatarUrl} className="w-full h-full object-cover" alt="" />
                              </div>
                              <span className="text-sm font-bold text-haven-navy">{booking.tenant.firstName} {booking.tenant.lastName}</span>
                            </div>
                          </td>
                          <td data-label="Logement" className="py-4">
                            <span className="text-sm font-medium text-gray-600">{listings.find(l => l.id === booking.listingId)?.title}</span>
                          </td>
                          <td data-label="Dates" className="py-4">
                            <span className="text-xs font-bold text-haven-navy">
                              {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
                            </span>
                          </td>
                          <td data-label="Statut" className="py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                              booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-600' :
                              booking.status === 'APPROVED' ? 'bg-blue-100 text-blue-600' :
                              booking.status === 'PENDING' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
                            }`}>
                              {booking.status === 'CONFIRMED' ? 'Confirmé' : 
                               booking.status === 'APPROVED' ? 'Accepté (Attente paiement)' :
                               booking.status === 'PENDING' ? 'En attente de paiement' : booking.status === 'COMPLETED' ? 'Séjour terminé' : 'Annulé'}
                            </span>
                            <BookingCountdown booking={booking} />
                          </td>
                          <td data-label="Actions" className="py-4 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Link to={`/messages/${booking.id}`}>
                                  <Button size="sm" variant="ghost" className="text-haven-navy"><MessageCircle size={16} /></Button>
                                </Link>
                                {booking.status === 'CONFIRMED' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-haven-red border-red-100 hover:bg-red-50"
                                    onClick={() => setCancellationBooking(booking)}
                                  >
                                    Annuler le séjour
                                  </Button>
                                )}
                                <OwnerBookingActions booking={booking} listing={listings.find(item => item.id === booking.listingId)} tenant={booking.tenant} onCancel={() => setCancellationBooking(booking)} />
                              </div>
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
                <OwnerPayoutSettings payouts={ownerPayouts} />
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-haven-navy rounded-3xl p-4 sm:p-8 text-white min-h-[160px] flex flex-col justify-center">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Revenus versés</p>
                    <p className="text-4xl font-bold mt-2">{payoutLoading || payoutError ? '—' : money(stats.totalRevenue)}</p>
                    <p className="text-xs text-blue-200 mt-4 leading-relaxed italic opacity-80">
                      Montants nets effectivement versés sur votre compte bancaire, hors frais Haven et simulations.
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-3xl p-4 sm:p-8 border border-blue-100 flex flex-col justify-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Virements en attente</p>
                    <p className="text-3xl font-bold text-haven-navy mt-2">{payoutLoading || payoutError ? '—' : money(stats.pendingRevenue)}</p>
                    <p className="text-xs text-gray-500 mt-4 italic">
                      Virements réels programmés ou en cours, jusqu’à confirmation de leur versement.
                    </p>
                  </div>
                </div>

                {payoutError && <p role="alert" className="text-sm text-haven-red">{payoutError}</p>}
                <section className="space-y-4">
                  <h3 className="font-heading font-bold text-xl text-haven-navy">Vos virements</h3>
                  {payoutLoading ? <p className="text-sm text-gray-500">Chargement des virements…</p> : !payoutError && realOwnerPayouts(ownerPayouts).length === 0 ? <p className="rounded-2xl border border-gray-100 bg-gray-50 p-5 text-sm text-gray-500">Aucun virement réel enregistré. Les paiements simulés des réservations ne sont pas inclus dans vos revenus.</p> : !payoutError && <div className="overflow-x-auto"><table className="haven-table w-full text-left text-sm"><thead><tr className="border-b border-gray-100 text-xs text-gray-500"><th className="py-3">Date</th><th>Référence</th><th>Montant net</th><th>Statut</th></tr></thead><tbody>{realOwnerPayouts(ownerPayouts).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(payout => <tr key={payout.id} className="border-b border-gray-50"><td data-label="Date" className="py-4">{new Date(payout.paidAt || payout.createdAt).toLocaleDateString('fr-FR')}</td><td data-label="Référence" className="max-w-48 break-all pr-4 text-xs text-gray-500">{payout.providerPayoutId || payout.id}</td><td data-label="Montant net" className="font-bold">{money(payout.amountCents / 100)}</td><td data-label="Statut">{ownerPayoutStatusLabel(payout.status)}</td></tr>)}</tbody></table></div>}
                </section>
                <div className="space-y-4">
                  <h3 className="font-heading font-bold text-xl text-haven-navy">Paiements des réservations</h3>
                  <p className="text-sm text-gray-500">Règlements des locataires, frais Haven inclus. Ces montants ne correspondent pas aux virements vers votre compte bancaire.</p>
                  <div className="overflow-x-auto">
                    <table className="haven-table w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Date</th>
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Description</th>
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Montant</th>
                          <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {ownerPayments.map(payment => {
                          const isRefund = payment.type === 'REFUND';
                          const paymentIsTest = payment.isTest === true || payment.provider === 'SIMULATION' || ownerBookings.find(booking => booking.id === payment.bookingId)?.paymentIsTest === true;
                          const paymentStatus = paymentIsTest ? isRefund ? 'Remboursement simulé' : 'Paiement simulé' : payment.status === 'COMPLETED' ? 'Réglé par le locataire' : payment.status === 'REFUNDED' ? 'Remboursé' : payment.status === 'PENDING' ? 'En attente' : 'Échoué';
                          return (
                          <tr key={payment.id}>
                            <td data-label="Date" className="py-4 text-sm text-gray-600">{new Date(payment.createdAt).toLocaleDateString()}</td>
                            <td data-label="Réservation" className="py-4 text-sm font-bold text-haven-navy">{isRefund ? 'Remboursement' : 'Réservation'} - {listings.find(l => l.id === payment.listingId)?.title || 'Logement supprimé'}</td>
                            <td data-label="Montant" className={`py-4 text-sm font-black ${isRefund ? 'text-haven-red' : payment.status === 'COMPLETED' ? 'text-green-600' : 'text-gray-500'}`}>{isRefund ? '-' : '+'}{payment.amount}€</td>
                            <td data-label="Statut" className="py-4">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${payment.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : payment.status === 'REFUNDED' ? 'bg-red-50 text-haven-red' : payment.status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{paymentStatus}</span>{paymentIsTest && <span className="ml-2 text-xs font-bold text-amber-700">Test</span>}
                            </td>
                          </tr>
                          );
                        })}
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

            {activeTab === 'DOCUMENTS' && (() => {
              const verificationDocuments = [
                { id: 'idCard' as const, label: 'Pièce d’identité', detail: 'Carte nationale d’identité ou passeport.', icon: ShieldCheck },
              ];
              return (
                <div className="space-y-8">
                  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                      <h3 className="font-heading font-bold text-xl text-haven-navy">Ma pièce d’identité</h3>
                      <p className="mt-1 text-sm text-gray-500">Elle est contrôlée par HAVEN avant la publication de vos logements.</p>
                    </div>
                    <Button variant="primary" size="sm" onClick={() => setIsVerificationModalOpen(true)} className="flex items-center gap-2">
                      <Upload size={15} /> Ajouter ou remplacer
                    </Button>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    {verificationDocuments.map(document => {
                      const url = currentUser?.documents?.[document.id];
                      const status = url ? (canPublish ? 'Validé' : 'En attente') : 'Manquant';
                      return (
                        <div key={document.id} className="rounded-3xl border border-gray-100 bg-gray-50/60 p-6">
                          <div className="flex items-start gap-4">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${status === 'Validé' ? 'bg-green-100 text-green-600' : url ? 'bg-orange-100 text-orange-600' : 'bg-white text-gray-400'}`}>
                              <document.icon size={22} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="font-bold text-haven-navy">{document.label}</h4>
                                <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${status === 'Validé' ? 'bg-green-100 text-green-700' : status === 'En attente' ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-500'}`}>{status}</span>
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-gray-500">{document.detail}</p>
                            </div>
                          </div>
                          <div className="mt-5 flex gap-3">
                            {url && <Button variant="outline" size="sm" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>Visualiser</Button>}
                            <Button variant="ghost" size="sm" className="text-haven-navy" onClick={() => setIsVerificationModalOpen(true)}>{url ? 'Remplacer' : 'Télécharger'}</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!canPublish && <div className="rounded-2xl border border-orange-100 bg-orange-50 px-5 py-4 text-sm text-orange-800">Transmettez votre pièce d’identité et complétez les confirmations de votre e-mail et de votre téléphone. HAVEN examinera ensuite votre identité.</div>}
                </div>
              );
            })()}

            {activeTab === 'INCIDENTS' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-heading font-bold text-xl text-haven-navy">Incidents à gérer</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex items-center gap-2"><Filter size={14}/> Filtrer</Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-2"><Download size={14}/> Exporter</Button>
                  </div>
                </div>

                {incidentError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{incidentError}</p>}
                <p className="text-sm text-gray-500">Les locataires vous transmettent les problèmes du logement. Prenez-les en charge et renseignez leur résolution.</p>
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
                            {incidentStatusLabel(incident.status)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-1">{incident.description}</p>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-widest">
                          {listings.find(l => l.id === incident.listingId)?.title} • Signalé le {new Date(incident.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={() => setSelectedIncidentId(incident.id)}>Détails</Button>
                        {(incident.status === 'NEW' || incident.status === 'INVESTIGATING') && <Button variant="primary" size="sm" className="flex-1 md:flex-none" onClick={() => setSelectedIncidentId(incident.id)}>Gérer</Button>}
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
      {selectedIncident && <OwnerIncidentDetail key={selectedIncident.id} incident={selectedIncident}
        listingTitle={listings.find(item => item.id === selectedIncident.listingId)?.title || 'Logement'}
        onClose={() => setSelectedIncidentId(null)}
        onUpdated={update => setOwnerIncidents(previous => previous.map(item => item.id === selectedIncident.id ? { ...item, ...update } : item))} />}
      {cancellationBooking && (
        <CancellationModal
          booking={cancellationBooking}
          actor="OWNER"
          onClose={() => setCancellationBooking(null)}
          onCancelled={(bookingId, cancellation) => {
            setOwnerBookings(previous => previous.map(booking => booking.id === bookingId ? { ...booking, status: 'CANCELLED', cancellation } : booking));
            toast.success(cancellation.refundAmount > 0 ? `Séjour annulé. ${cancellation.refundAmount} € seront remboursés au locataire.` : 'Demande de réservation annulée.');
          }}
        />
      )}
    </div>
  );
};
