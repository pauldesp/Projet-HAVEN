import { OwnerPayoutSettings } from '../components/OwnerPayoutSettings';
import { ScrollableRow } from '../components/ScrollableRow';
import { OwnerBookingActions } from '../components/OwnerBookingActions';
import { OwnerDamageClaimButton, useDamageClaims } from '../components/DamageClaims';
import { BookingCountdown } from '../components/BookingCountdown';
import { bookingCategory } from '../services/bookingLifecycle';
import { hasVerificationException } from '../services/verificationException';
import { hasRequiredPhoneNumber, isVerificationPending } from '../services/profileVerification';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { OwnerIncidentDetail, incidentStatusLabel } from '../components/OwnerIncidentDetail';
import { Button } from '../components/Button';
import { Plus, Home, CheckCircle, Loader2, AlertTriangle, ShieldCheck, MessageCircle, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useListings } from '../contexts/ListingContext';
import { apiService } from '../services/api';
import { Booking, UserRole, Incident, Payment, OwnerPayout, User } from '../types';
import { AccountStatusOverlay } from '../components/AccountStatusOverlay';
import { CancellationModal } from '../components/CancellationModal';
import { toast } from 'sonner';
import { formatEuros } from '../services/money';
import { getCancellationTerms } from '../services/cancellationPolicy';
import { installmentDateLabel } from '../services/recurringInstallments';
import { calculateOwnerFinanceStats, ownerEarningsSummary, realOwnerPayouts, ownerPayoutStatusLabel } from '../services/ownerFinances';

interface BookingWithTenant extends Booking {
  tenant: User;
}

export const OwnerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const { listings } = useListings();
  const [activeTab, setActiveTab] = useState<'LISTINGS' | 'BOOKINGS' | 'FINANCES' | 'DOCUMENTS' | 'INCIDENTS'>(searchParams.has('stripe') ? 'FINANCES' : 'LISTINGS');
  const [ownerBookings, setOwnerBookings] = useState<BookingWithTenant[]>([]);
  const damageClaims = useDamageClaims(Boolean(currentUser?.id));
  const [ownerIncidents, setOwnerIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [incidentError, setIncidentError] = useState('');
  const selectedIncident = ownerIncidents.find(item => item.id === selectedIncidentId);
  const [ownerPayments, setOwnerPayments] = useState<Payment[]>([]);
  const [ownerPayouts, setOwnerPayouts] = useState<OwnerPayout[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [payoutError, setPayoutError] = useState('');
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
  const [isLoading, setIsLoading] = useState(true);
  // With real payments, Haven publishes a listing only once the owner can receive payouts.
  const [payoutsToConfigure, setPayoutsToConfigure] = useState(false);
  useEffect(() => {
    if (!currentUser?.id) return;
    let active = true;
    apiService.ownerConnect.getMine().then(({ account }) => { if (active) setPayoutsToConfigure(account.available && account.status !== 'READY'); }).catch(() => undefined);
    return () => { active = false; };
  }, [currentUser?.id]);
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
    };
  }, [currentUser, listings]);

  useEffect(() => {
    setOwnerIncidents([]); setIncidentError(''); setSelectedIncidentId(null);
    if (!currentUser?.id) return;
    return apiService.incidents.listenByOwnerId(currentUser.id, setOwnerIncidents,
      () => setIncidentError('Impossible de charger les incidents. Actualisez la page pour réessayer.'));
  }, [currentUser?.id]);

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
  const earnings = ownerEarningsSummary(ownerBookings, ownerPayouts);
  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const openIncidents = ownerIncidents.filter(i => i.status === 'NEW' || i.status === 'INVESTIGATING').length;
  const listingStatus: Record<string, { label: string; dot: string }> = {
    APPROVED: { label: 'En ligne', dot: 'bg-green-500' },
    PENDING: { label: 'En vérification', dot: 'bg-orange-500' },
    REJECTED: { label: 'Refusé', dot: 'bg-haven-red' },
    DRAFT: { label: 'Brouillon', dot: 'bg-gray-400' },
  };

  const now = new Date();
  
  const upcomingBookings = ownerBookings.filter(b => bookingCategory(b, now) === 'UPCOMING');
  const currentBookings = ownerBookings.filter(b => bookingCategory(b, now) === 'CURRENT');
  const pastBookings = ownerBookings.filter(b => bookingCategory(b, now) === 'PAST');

  const displayedBookings = bookingSubTab === 'UPCOMING' ? upcomingBookings :
                            bookingSubTab === 'CURRENT' ? currentBookings : pastBookings;

  if (isLoading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-haven-navy"/></div>;

  return (
    <div className="min-h-screen bg-white pb-20 font-body">
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-haven-navy sm:text-3xl">Espace propriétaire</h1>
            <Link to={`/profile/${currentUser?.id}`} className="mt-1 inline-block text-sm text-gray-500 underline underline-offset-4 decoration-gray-300 hover:text-haven-navy">Voir mon profil public</Link>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button type="button" onClick={handlePublishClick} className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-haven-navy px-4 text-sm font-bold text-white transition-colors hover:bg-haven-navy/90 sm:px-5">
              <Plus size={18} aria-hidden="true" /> Ajouter un logement
            </button>
          </div>
        </header>

        {!canPublish && (
          <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-orange-100 bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck size={22} className="mt-0.5 shrink-0 text-orange-600" aria-hidden="true" />
              <div>
                <h2 className="font-bold text-haven-navy">{isSubmittedForReview ? 'Dossier en cours de vérification' : 'Dossier propriétaire requis'}</h2>
                <p className="text-sm text-gray-600">{isSubmittedForReview ? 'Votre dossier a été transmis à Haven. Un administrateur vérifie votre identité avant d’activer la mise en ligne.' : 'Votre pièce d’identité doit être validée avant toute mise en ligne.'}</p>
              </div>
            </div>
            <Button variant="primary" size="sm" className="shrink-0 border-none bg-orange-500 px-6 hover:bg-orange-600" onClick={() => setIsVerificationModalOpen(true)}>
              {isSubmittedForReview ? 'Dossier en cours de validation' : 'Compléter mon dossier'}
            </Button>
          </div>
        )}

        {payoutsToConfigure && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 className="font-bold text-haven-navy">Configurez vos versements</h2>
              <p className="text-sm text-gray-600">Vos logements ne peuvent être mis en ligne qu’une fois vos versements Stripe activés (identité et compte bancaire). C’est ce compte qui reçoit le paiement de chaque séjour à l’arrivée du locataire.</p>
            </div>
            <Button variant="primary" size="sm" className="shrink-0 px-6" onClick={() => setActiveTab('FINANCES')}>Configurer mes versements</Button>
          </div>
        )}

        <section aria-label="Vos revenus" className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4">
          <button type="button" onClick={() => setActiveTab('FINANCES')} className="rounded-2xl border border-gray-200 p-4 text-left transition-shadow hover:shadow-md sm:p-6">
            <p className="font-bold text-haven-navy">Revenus versés</p>
            <p className="text-sm capitalize text-gray-500">{monthLabel}</p>
            <p className="mt-4 text-2xl font-bold text-haven-navy sm:mt-6 sm:text-4xl">{payoutLoading || payoutError ? '—' : formatEuros(earnings.paidThisMonth)}</p>
          </button>
          <button type="button" onClick={() => { setBookingSubTab('UPCOMING'); setActiveTab('BOOKINGS'); }} className="rounded-2xl border border-gray-200 p-4 text-left transition-shadow hover:shadow-md sm:p-6">
            <p className="font-bold text-haven-navy">À venir</p>
            <p className="text-sm text-gray-500">Versé à l’arrivée des locataires</p>
            <p className="mt-4 text-2xl font-bold text-haven-navy sm:mt-6 sm:text-4xl">{payoutLoading || payoutError ? '—' : formatEuros(earnings.upcoming)}</p>
            {earnings.upcomingSimulated > 0 && <p className="mt-1 text-xs text-amber-700">dont {formatEuros(earnings.upcomingSimulated)} issus de paiements de test (aucun argent réel)</p>}
          </button>
        </section>
        {payoutError && <p role="alert" className="mt-3 text-xs text-haven-red">{payoutError}</p>}

        <div className="mt-8">
          <ScrollableRow as="nav" ariaLabel="Sections de l’espace propriétaire" label="onglets" fadeFrom="from-white" outerClassName="-mx-4 mb-6 sm:mx-0 sm:mb-8" className="haven-tabs flex gap-6 border-b border-gray-200 px-4 sm:gap-8 sm:px-0">
            {[
              { id: 'LISTINGS', label: 'Logements', badge: 0 },
              { id: 'BOOKINGS', label: 'Réservations', badge: 0 },
              { id: 'FINANCES', label: 'Finances', badge: 0 },
              { id: 'DOCUMENTS', label: 'Documents', badge: 0 },
              { id: 'INCIDENTS', label: 'Signalements', badge: openIncidents },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`relative flex min-h-12 shrink-0 items-center gap-1.5 whitespace-nowrap pb-3 text-sm font-semibold transition-colors ${activeTab === tab.id ? 'text-haven-navy' : 'text-gray-500 hover:text-haven-navy'}`}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
              >
                {tab.label}
                {tab.badge > 0 && <span className="rounded-full bg-haven-red px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{tab.badge}</span>}
                {activeTab === tab.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-haven-navy" />}
              </button>
            ))}
          </ScrollableRow>

          <div className="space-y-6">
            {activeTab === 'LISTINGS' && (
              <div>
                {ownerListings.length > 0 && <div className="hidden grid-cols-[minmax(0,1fr)_10rem_8rem_8rem] gap-4 border-b border-gray-100 pb-3 text-sm font-semibold text-gray-500 md:grid">
                  <span>Logement</span><span>Ville</span><span>Chambres</span><span>Statut</span>
                </div>}
                <ul className="divide-y divide-gray-100">
                  {ownerListings.map(listing => {
                    const status = listing.suspendedByHaven ? { label: 'Suspendue par Haven', dot: 'bg-haven-red' } : listingStatus[listing.status] || listingStatus.DRAFT;
                    return (
                      <li key={listing.id}>
                        <Link to={`/owner/edit/${listing.id}`} className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-4 rounded-xl py-3 transition-colors hover:bg-gray-50 md:grid-cols-[4rem_minmax(0,1fr)_10rem_8rem_8rem] md:-mx-2 md:px-2">
                          {listing.mainPhotoUrl ? <img src={listing.mainPhotoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <span className="h-16 w-16 rounded-xl bg-gray-100" />}
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-haven-navy">{listing.title || 'Logement sans titre'}</span>
                            <span className="mt-1 flex items-center gap-2 text-sm text-gray-500 md:hidden">{listing.city}<span aria-hidden="true">·</span><span className={`h-2 w-2 rounded-full ${status.dot}`} aria-hidden="true" />{status.label}</span>
                          </span>
                          <span className="hidden text-sm text-gray-600 md:block">{listing.city}</span>
                          <span className="hidden text-sm text-gray-600 md:block">{listing.rooms.length}</span>
                          <span className="hidden items-center gap-2 text-sm text-gray-600 md:flex"><span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} aria-hidden="true" />{status.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {ownerListings.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-200 py-10 text-center sm:py-16">
                    <Home size={40} className="mx-auto mb-3 text-gray-300" aria-hidden="true" />
                    <p className="font-semibold text-gray-500">Vous n’avez pas encore de logement.</p>
                    <Button variant="primary" className="mt-4" onClick={handlePublishClick}>Publier mon premier logement</Button>
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
                              {new Date(booking.startDate).toLocaleDateString('fr-FR')} - {new Date(booking.endDate).toLocaleDateString('fr-FR')}
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
                               booking.status === 'PENDING' ? booking.seriesScheduled && booking.installmentDueDate ? `Réservé · prélèvement le ${installmentDateLabel(booking.installmentDueDate)}` : 'En attente de paiement' : booking.status === 'COMPLETED' ? 'Séjour terminé' : 'Annulé'}
                            </span>
                            <BookingCountdown booking={booking} />
                          </td>
                          <td data-label="Actions" className="py-4 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Link to={`/messages/${booking.id}`}>
                                  <Button size="sm" variant="ghost" className="text-haven-navy"><MessageCircle size={16} /></Button>
                                </Link>
                                {(booking.status === 'CONFIRMED' || (booking.status === 'PENDING' && booking.seriesScheduled)) && (getCancellationTerms(booking, 'OWNER').canCancel ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-haven-red border-red-100 hover:bg-red-50"
                                    onClick={() => setCancellationBooking(booking)}
                                  >
                                    Annuler le séjour
                                  </Button>
                                ) : bookingCategory(booking) === 'UPCOMING' && <span className="self-center text-[11px] text-gray-500">Annulation via Haven (moins de 30 j)</span>)}
                                <OwnerDamageClaimButton booking={booking} claim={damageClaims.claims.find(claim => claim.bookingId === booking.id)} onChanged={() => void damageClaims.reload()} />
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

            {activeTab === 'FINANCES' && (
              <div className="space-y-8">
                <OwnerPayoutSettings payouts={ownerPayouts} />
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-gray-200 p-4"><dt className="text-gray-500">Total versé sur votre compte</dt><dd className="mt-1 text-xl font-bold text-haven-navy">{payoutLoading || payoutError ? '—' : formatEuros(financeStats.totalRevenue)}</dd></div>
                  <div className="rounded-2xl border border-gray-200 p-4"><dt className="text-gray-500">Virements en cours</dt><dd className="mt-1 text-xl font-bold text-haven-navy">{payoutLoading || payoutError ? '—' : formatEuros(financeStats.pendingRevenue)}</dd></div>
                </dl>
                <p className="text-xs text-gray-500">Montants nets réellement virés par Stripe, hors frais Haven. Les paiements simulés n’y figurent pas.</p>

                {payoutError && <p role="alert" className="text-sm text-haven-red">{payoutError}</p>}
                <section className="space-y-4">
                  <h3 className="font-heading font-bold text-xl text-haven-navy">Vos virements</h3>
                  {payoutLoading ? <p className="text-sm text-gray-500">Chargement des virements…</p> : !payoutError && realOwnerPayouts(ownerPayouts).length === 0 ? <p className="rounded-2xl border border-gray-100 bg-gray-50 p-5 text-sm text-gray-500">Aucun virement réel enregistré. Les paiements simulés des réservations ne sont pas inclus dans vos revenus.</p> : !payoutError && <div className="overflow-x-auto"><table className="haven-table w-full text-left text-sm"><thead><tr className="border-b border-gray-100 text-xs text-gray-500"><th className="py-3">Date</th><th>Référence</th><th>Montant net</th><th>Statut</th></tr></thead><tbody>{realOwnerPayouts(ownerPayouts).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map(payout => <tr key={payout.id} className="border-b border-gray-50"><td data-label="Date" className="py-4">{new Date(payout.paidAt || payout.createdAt).toLocaleDateString('fr-FR')}</td><td data-label="Référence" className="max-w-48 break-all pr-4 text-xs text-gray-500">{payout.providerPayoutId || payout.id}</td><td data-label="Montant net" className="font-bold">{formatEuros(payout.amountCents / 100)}</td><td data-label="Statut">{ownerPayoutStatusLabel(payout.status)}</td></tr>)}</tbody></table></div>}
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
                            <td data-label="Date" className="py-4 text-sm text-gray-600">{new Date(payment.createdAt).toLocaleDateString('fr-FR')}</td>
                            <td data-label="Réservation" className="py-4 text-sm font-bold text-haven-navy">{isRefund ? 'Remboursement' : 'Réservation'} - {listings.find(l => l.id === payment.listingId)?.title || 'Logement supprimé'}</td>
                            <td data-label="Montant" className={`py-4 text-sm font-black ${isRefund ? 'text-haven-red' : payment.status === 'COMPLETED' ? 'text-green-600' : 'text-gray-500'}`}>{isRefund ? '−' : '+'}{formatEuros(payment.amount)}</td>
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
                {incidentError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{incidentError}</p>}
                <p className="text-sm text-gray-500">Les problèmes du logement signalés par vos locataires. Prenez-les en charge et renseignez leur résolution.</p>
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
                          {listings.find(l => l.id === incident.listingId)?.title} • Signalé le {new Date(incident.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={() => setSelectedIncidentId(incident.id)}>Détails</Button>
                        {(incident.status === 'NEW' || incident.status === 'INVESTIGATING') && <Button variant="primary" size="sm" className="flex-1 md:flex-none" onClick={() => setSelectedIncidentId(incident.id)}>Gérer</Button>}
                      </div>
                    </div>
                  ))}

                  {ownerIncidents.length === 0 && (
                    <div className="text-center py-10 sm:py-20 bg-gray-50 rounded-[1.75rem] sm:rounded-[2.5rem] border border-dashed border-gray-200">
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
