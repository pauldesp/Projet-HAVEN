import { countNights, isBookableStay } from '../services/stay';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { BookingModal } from '../components/BookingModal';
import { ListingCalendar } from '../components/ListingCalendar';
import ReactMarkdown from 'react-markdown';
import { Star, MapPin, Wifi, Layout, Users, Check, Share, Heart, Calendar, Lock, Maximize2, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useListings } from '../contexts/ListingContext';
import { apiService } from '../services/api';
import { BookingAvailability, User } from '../types';
import { toast } from 'sonner';

import { useAuth } from '../contexts/AuthContext';
import { AccountStatusOverlay } from '../components/AccountStatusOverlay';
import { ReportModal } from '../components/ReportModal';
import { isRoomAvailableForStay } from '../services/availability';
import { getListingPhotoUrls } from '../services/media';
import { shareOrCopy } from '../services/share';
import { readSearchDates } from '../services/searchDates';
import { userFacingErrorMessage } from '../services/errorHandling';
import { minimumNights } from '../services/minimumStay';

export const ListingDetails: React.FC = () => {
  const { id } = useParams();
  const { currentUser, refreshUser } = useAuth();
  const { getListingById, updateListing } = useListings();
  const listing = getListingById(id || '');
  const calendarRef = useRef<HTMLDivElement>(null);

  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [owner, setOwner] = useState<User | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);
  const [isOwnerMode, setIsOwnerMode] = useState(false);
  const [availability, setAvailability] = useState<BookingAvailability[]>([]);
  const [isFavoriteUpdating, setIsFavoriteUpdating] = useState(false);
  
  const isApproved = currentUser?.status === 'APPROVED' || currentUser?.role === 'ADMIN';
  const isListingOwner = currentUser?.id === listing?.ownerId;
  const isHost = currentUser?.role === 'OWNER';

  useEffect(() => {
    if (isListingOwner) {
      setIsOwnerMode(true);
    }
  }, [isListingOwner]);
  
  // États pour les dates sélectionnées (synchronisés entre calendrier et sidebar)
  const [searchParams, setSearchParams] = useSearchParams();
  const { start: startDate, end: endDate } = readSearchDates(searchParams);

  useEffect(() => {
    const fetchOwner = async () => {
      if (listing?.ownerId) {
        const ownerData = await apiService.users.getById(listing.ownerId);
        if (ownerData) setOwner(ownerData);
      }
    };
    fetchOwner();
  }, [listing?.ownerId]);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!listing?.id) return;
      setIsReviewsLoading(true);
      try {
        const data = await apiService.reviews.getByTargetId(listing.id);
        setReviews(data || []);
      } catch (e) {
        console.error("Error fetching reviews", e);
      } finally {
        setIsReviewsLoading(false);
      }
    };
    fetchReviews();
  }, [listing?.id]);

  useEffect(() => {
    if (!listing?.id) return;
    return apiService.availability.listenByListingId(listing.id, setAvailability);
  }, [listing?.id]);

  if (!listing) return <div className="pt-24 text-center">Logement non trouvé</div>;

  const isRoomAvailable = (room: typeof listing.rooms[number]) =>
    isRoomAvailableForStay(room, listing, availability, startDate, endDate);
  const defaultRoom = listing.rooms.find(isRoomAvailable) || listing.rooms[0];
  const requestedRoom = selectedRoomId ? listing.rooms.find(r => r.id === selectedRoomId) : undefined;
  const activeRoom = requestedRoom && isRoomAvailable(requestedRoom) ? requestedRoom : defaultRoom;
  const activeRoomIsAvailable = isRoomAvailable(activeRoom);

  const activeRoomBookings = availability.filter(
    b => b.roomId === activeRoom.id && ['PENDING', 'APPROVED', 'CONFIRMED'].includes(b.status)
  );

  // 2. TOUTES les réservations confirmées de la maison (pour afficher les visages sur le calendrier)
  const allHouseBookings = availability.filter(
    b => b.status === 'CONFIRMED'
  );

  const handleBookClick = () => {
    if (!isBookableStay(startDate, endDate)) {
      toast.error('La date d’arrivée doit être aujourd’hui ou ultérieure.');
      return;
    }
    if (!activeRoomIsAvailable) {
      toast.error('Cette chambre n’est pas disponible pour les dates sélectionnées.');
      return;
    }
    if (!currentUser) {
      // Redirect to login or show login modal
      window.location.hash = `/login?redirect=${encodeURIComponent(`/listing/${id}?${searchParams.toString()}`)}`;
      return;
    }

    if (isListingOwner) {
      toast.error('Vous ne pouvez pas réserver votre propre logement. (Erreur 403)');
      return;
    }

    if (isHost && !isListingOwner) {
      toast.error('Basculez en mode locataire pour réserver ce logement. (Erreur 403)');
      return;
    }
    
    if (!isApproved) {
      setIsVerificationModalOpen(true);
      return;
    }

    if (nights < minimumNights(listing.minStay)) {
      toast.error(`Ce logement nécessite un séjour minimum de ${minimumNights(listing.minStay)} nuits. (Erreur 422)`);
      return;
    }
    
    setIsBookingOpen(true);
  };

  const handleDateSelect = (start: string, end: string) => {
    const next = new URLSearchParams(searchParams);
    if (start) next.set('start', start); else next.delete('start');
    if (end) next.set('end', end); else next.delete('end');
    setSearchParams(next, { replace: true });
  };

  const handleShare = async () => {
    const result = await shareOrCopy({
      title: `${listing.title} | HAVEN`,
      text: `Découvrez ${listing.title}, une colocation à ${listing.city}.`,
      url: window.location.href
    });

    if (result === 'shared') toast.success('Annonce partagée !');
    if (result === 'copied') toast.success('Lien de l’annonce copié.');
    if (result === 'unavailable') toast.error('Le partage est indisponible sur ce navigateur.');
  };

  const handleFavorite = async () => {
    const returnTo = `/listing/${id}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    if (!currentUser) {
      window.location.hash = `/login?redirect=${encodeURIComponent(returnTo)}`;
      return;
    }

    const wasFavorite = currentUser.favorites?.includes(listing.id) ?? false;
    setIsFavoriteUpdating(true);
    try {
      await apiService.users.toggleFavorite(currentUser.id, listing.id);
      await refreshUser();
      toast.success(wasFavorite ? 'Annonce retirée de vos favoris.' : 'Annonce ajoutée à vos favoris.');
    } catch (error) {
      console.error('Erreur lors de la mise à jour des favoris', error);
      toast.error(userFacingErrorMessage(error));
    } finally {
      setIsFavoriteUpdating(false);
    }
  };

  const handleSaveBlockedDates = async (dates: string[]) => {
    if (!listing || !activeRoom) return;
    
    const updatedListing = { ...listing };
    updatedListing.rooms = listing.rooms.map(r => 
      r.id === activeRoom.id ? { ...r, blockedDates: dates } : r
    );
    
    try {
      await updateListing(updatedListing);
      toast.success("Calendrier mis à jour avec succès !");
    } catch (e) {
      console.error(e);
      toast.error(userFacingErrorMessage(e));
    }
  };

  const nights = countNights(startDate, endDate);

  const basePrice = activeRoom.pricePerDay * nights;
  const cleaningFee = listing.cleaningFee || 0;
  const platformFee = Math.round(basePrice * 0.15);
  const totalPrice = basePrice + cleaningFee + platformFee;
  const listingPhotos = getListingPhotoUrls(listing);
  const isFavorite = currentUser?.favorites?.includes(listing.id) ?? false;

  return (
    <>
      <div className="pt-8 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Gallery */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[400px] md:h-[500px] rounded-3xl overflow-hidden mb-8">
            <img src={listingPhotos[0] || listing.mainPhotoUrl} alt="Photo principale du logement" className="w-full h-full object-cover" />
            <div className="grid grid-cols-2 gap-4">
               {listingPhotos.slice(1).length > 0 ? (
                  listingPhotos.slice(1).map((url, i) => (
                    <div key={url} className="relative overflow-hidden">
                      <img src={url} alt={`Photo ${i + 2} du logement`} className="w-full h-full object-cover" />
                      {i === listingPhotos.slice(1).length - 1 && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-bold cursor-pointer hover:bg-black/50 transition-colors">
                          {listingPhotos.length} photo{listingPhotos.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  ))
               ) : (
                  <div className="bg-gray-200 w-full h-full flex items-center justify-center text-gray-500">Plus de photos bientôt</div>
               )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Main Info */}
            <div className="lg:col-span-2">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="font-heading font-bold text-3xl md:text-4xl text-haven-navy mb-2">{listing.title}</h1>
                  <div className="flex items-center gap-4 text-gray-600">
                    <span className="flex items-center gap-1"><MapPin size={16}/> {listing.city}</span>
                    <span className="flex items-center gap-1"><Star size={16} className="text-haven-red fill-haven-red"/> {listing.rating} ({listing.reviewsCount} avis)</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-3 rounded-full border border-gray-200 hover:bg-gray-50 text-haven-navy" title="Signaler"><AlertCircle size={20} onClick={() => setIsReportModalOpen(true)} /></button>
                  <button type="button" onClick={handleShare} aria-label="Partager cette annonce" title="Partager cette annonce" className="p-3 rounded-full border border-gray-200 hover:bg-gray-50 text-haven-navy"><Share size={20}/></button>
                  <button type="button" onClick={handleFavorite} disabled={isFavoriteUpdating} aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} className={`p-3 rounded-full border border-gray-200 hover:bg-gray-50 text-haven-navy disabled:cursor-wait ${isFavorite ? 'bg-haven-red/5 text-haven-red border-haven-red/20' : ''}`}>
                    {isFavoriteUpdating ? <Loader2 size={20} className="animate-spin" /> : <Heart size={20} className={isFavorite ? 'fill-current' : ''}/>} 
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-6 py-6 border-y border-gray-100 mb-8">
                 <div className="flex flex-col items-center">
                    <span className="font-bold text-haven-navy">{listing.totalRooms}</span>
                    <span className="text-sm text-gray-500">Chambres</span>
                 </div>
                 <div className="w-px h-10 bg-gray-200"></div>
                 <div className="flex flex-col items-center">
                    <span className="font-bold text-haven-navy">{listing.surface}m²</span>
                    <span className="text-sm text-gray-500">Surface</span>
                 </div>
                 <div className="w-px h-10 bg-gray-200"></div>
                 <div className="flex flex-col items-center">
                    <span className="font-bold text-haven-navy">{listing.type === 'HOUSE' ? 'Maison' : 'Appartement'}</span>
                    <span className="text-sm text-gray-500">Type</span>
                 </div>
              </div>

              <div className="mb-10">
                <h2 className="font-heading font-bold text-xl mb-4">À propos du logement</h2>
                <div className="prose prose-slate max-w-none 
                  prose-p:text-gray-600 prose-p:leading-relaxed prose-p:mb-4 prose-p:mt-0
                  prose-li:text-gray-600 prose-li:my-0.5
                  prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-4
                  prose-ol:list-decimal prose-ol:pl-5 prose-ol:mb-4
                  prose-strong:text-haven-navy prose-strong:font-bold
                  break-words">
                  <ReactMarkdown>
                    {listing.description.replace(/\n/g, '  \n')}
                  </ReactMarkdown>
                </div>
              </div>

              {owner && (
                <div className="mb-10 p-6 bg-white rounded-3xl border border-gray-100 shadow-sm flex items-center gap-6">
                  <Link to={`/profile/${owner.id}`} className="flex-shrink-0">
                    <div className="relative">
                      <img 
                        src={owner.avatarUrl} 
                        alt={owner.firstName} 
                        className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md hover:scale-105 transition-transform" 
                      />
                      {owner.status === 'APPROVED' && (
                        <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-1 rounded-full border-2 border-white shadow-sm">
                          <ShieldCheck size={12} />
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-haven-navy text-lg">Propriétaire : {owner.firstName}</h3>
                      {owner.status === 'APPROVED' && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Vérifié
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                      {owner.bio || "Propriétaire passionné par l'accueil et le partage d'expériences."}
                    </p>
                    <Link to={`/profile/${owner.id}`}>
                      <Button variant="outline" size="sm">Voir le profil</Button>
                    </Link>
                  </div>
                </div>
              )}

              <div className="mb-10">
                <h2 className="font-heading font-bold text-xl mb-4">Équipements du logement</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Équipements standards HAVEN */}
                  <div className="flex items-center gap-3 text-gray-700 font-bold">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                      <Check size={16} />
                    </div>
                    Cuisine équipée
                  </div>
                  <div className="flex items-center gap-3 text-gray-700 font-bold">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                      <Check size={16} />
                    </div>
                    Ménage inclus
                  </div>
                  {/* Équipements sélectionnés par le proprio */}
                  {listing.amenities.map(item => (
                    <div key={item} className="flex items-center gap-3 text-gray-700">
                      <div className="w-8 h-8 rounded-lg bg-green-50 text-green-700 flex items-center justify-center">
                        <Check size={16} />
                      </div>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-10">
                <h2 className="font-heading font-bold text-xl mb-6">Chambres</h2>
                <div className="space-y-4">
                  {listing.rooms.map(room => {
                    const roomAvailable = isRoomAvailable(room);
                    const roomIsSelected = roomAvailable && (selectedRoomId === room.id || (!selectedRoomId && room.id === activeRoom.id));
                    return (
                    <div 
                      key={room.id} 
                      aria-disabled={!roomAvailable}
                      className={`border rounded-2xl p-4 flex flex-col md:flex-row gap-6 items-center transition-all ${roomAvailable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60 bg-gray-50'} ${roomIsSelected ? 'border-haven-navy ring-1 ring-haven-navy bg-blue-50/50' : 'border-gray-200'} ${roomAvailable ? 'hover:border-haven-navy/30' : ''}`}
                      onClick={() => {
                        if (roomAvailable) setSelectedRoomId(room.id);
                      }}
                    >
                      <div className="w-full md:w-48 h-32 rounded-xl overflow-hidden flex-shrink-0">
                        <img src={room.photoUrl} className="w-full h-full object-cover" alt={room.name} />
                      </div>
                      <div className="flex-1 w-full text-left">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-lg text-haven-navy">{room.name}</h3>
                          {roomAvailable ? 
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">Disponible</span> :
                            <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs font-bold">Indisponible pour vos dates</span>
                          }
                        </div>
                        <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 mb-3">
                           <span className="flex items-center gap-1 font-bold bg-gray-100 px-2 py-0.5 rounded-full"><Layout size={12}/> {room.size}m²</span>
                           <span className="flex items-center gap-1 font-bold bg-gray-100 px-2 py-0.5 rounded-full"><Users size={12}/> Lit {room.bedSize}</span>
                           <span className="flex items-center gap-1 font-bold bg-gray-100 px-2 py-0.5 rounded-full">{room.hasPrivateBath ? 'SDB Privée' : 'SDB Partagée'}</span>
                           {room.hasDesk && <span className="flex items-center gap-1 font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"><Maximize2 size={12}/> Bureau</span>}
                           {room.hasLock && <span className="flex items-center gap-1 font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"><Lock size={12}/> Verrou porte</span>}
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <div>
                            <span className="font-bold text-xl text-haven-navy">{room.pricePerDay}€</span>
                            <span className="text-gray-500 text-sm"> / nuit</span>
                          </div>
                          <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${roomIsSelected ? 'bg-haven-navy border-haven-navy' : 'border-gray-300'}`}>
                            {roomIsSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              </div>

              {/* CALENDAR SECTION */}
              <div ref={calendarRef} className="mb-10">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-heading font-bold text-xl flex items-center gap-2">
                    <Calendar size={24} className="text-haven-navy"/>
                    Disponibilités
                  </h2>
                  {isListingOwner && (
                    <div className="bg-haven-red/10 text-haven-red px-3 py-1 rounded-full text-xs font-bold border border-haven-red/20">
                      Mode Gestion Immobilière active
                    </div>
                  )}
                </div>
                
                {isListingOwner ? (
                  <p className="text-gray-500 mb-6 text-sm italic">
                    En tant que propriétaire, cliquez sur une date pour la bloquer/débloquer. 
                    Les périodes réservées restent visibles, sans afficher les données personnelles des locataires.
                  </p>
                ) : (
                  <p className="text-gray-500 mb-6 text-sm">
                    Sélectionnez vos dates pour <span className="font-bold text-haven-navy">{activeRoom.name}</span>. 
                    Séjour minimum : <span className="font-bold text-haven-navy">{listing.minStay} nuits</span>.
                    Les jours occupés sont indiqués sans exposer l'identité des locataires.
                  </p>
                )}
                
                <ListingCalendar 
                  activeRoomBookings={activeRoomBookings}
                  allHouseBookings={allHouseBookings}
                  selectedStart={startDate}
                  selectedEnd={endDate}
                  onDateSelect={handleDateSelect}
                  isOwner={isListingOwner}
                  blockedDates={activeRoom.blockedDates || []}
                  listingBlockedDates={listing.blockedDates || []}
                  onSaveBlockedDates={handleSaveBlockedDates}
                />
              </div>

              {/* REVIEWS SECTION */}
              <div className="mb-10 pt-10 border-t border-gray-100">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="font-heading font-bold text-2xl text-haven-navy flex items-center gap-2">
                    <Star size={24} className="text-haven-red fill-haven-red"/>
                    Avis de la communauté
                  </h2>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-haven-navy">{listing.rating} / 5</div>
                    <div className="text-xs text-gray-500">{listing.reviewsCount} avis vérifiés</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {isReviewsLoading ? (
                    <div className="col-span-full py-12 text-center">
                      <Loader2 className="animate-spin mx-auto text-haven-navy mb-4" />
                      <p className="text-gray-500 font-medium italic">CHARGEMENT DES AVIS VÉRIFIÉS...</p>
                    </div>
                  ) : reviews.length > 0 ? (
                    reviews.map((review, idx) => (
                      <div key={idx} className="bg-haven-cream/30 p-8 rounded-[2rem] border border-gray-100 hover:shadow-premium transition-all">
                        <div className="flex items-center gap-4 mb-6">
                           <div className="relative">
                              <img src={review.authorAvatarUrl || `https://ui-avatars.com/api/?name=${review.authorName}&background=random`} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" />
                              <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-0.5 rounded-full border-2 border-white">
                                <ShieldCheck size={10} />
                              </div>
                           </div>
                           <div className="text-left">
                              <h4 className="font-bold text-haven-navy">{review.authorName}</h4>
                              <div className="flex gap-0.5 text-haven-red">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} size={12} className={i < review.rating ? 'fill-haven-red' : 'text-gray-200'} />
                                ))}
                              </div>
                           </div>
                           <span className="ml-auto text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                              {new Date(review.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                           </span>
                        </div>
                        <p className="text-gray-600 text-sm leading-relaxed italic line-clamp-4">
                           "{review.comment}"
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                        <Star size={32} />
                      </div>
                      <p className="text-gray-500 font-medium">Aucun avis pour le moment sur ce logement.</p>
                      <p className="text-gray-400 text-sm mt-1">Les avis sont postés par les locataires à la fin de leur séjour.</p>
                    </div>
                  )}
                </div>
                
                <div className="mt-8 text-center">
                  <Button variant="outline">Voir tous les avis</Button>
                </div>
              </div>
            </div>

            {/* Sticky Sidebar */}
            {!isListingOwner && (
              <div className="lg:col-span-1">
                <div className="sticky top-24 bg-white p-6 rounded-3xl shadow-card border border-gray-100">
                  <h3 className="font-heading font-bold text-xl mb-4">Réserver <span className="text-haven-red">{activeRoom.name}</span></h3>
                  
                  <div 
                    className="bg-haven-cream p-4 rounded-xl mb-4 cursor-pointer hover:bg-haven-cream/80 transition-colors border border-transparent hover:border-haven-navy/20"
                    onClick={() => calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  >
                    <p className="text-sm font-medium text-gray-500 mb-2">Dates souhaitées</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-gray-200">
                        <span className="text-xs text-gray-400">Arrivée</span>
                        <span className="font-medium text-sm text-haven-navy">{startDate ? new Date(startDate).toLocaleDateString() : '-'}</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-gray-200">
                        <span className="text-xs text-gray-400">Départ</span>
                        <span className="font-medium text-sm text-haven-navy">{endDate ? new Date(endDate).toLocaleDateString() : '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6 text-left">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{activeRoom.pricePerDay}€ x {nights} nuit(s)</span>
                      <span>{activeRoom.pricePerDay * (nights)}€</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Frais de ménage (par location)</span>
                      <span>{listing.cleaningFee}€</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Frais HAVEN (15%)</span>
                      <span>{Math.round(activeRoom.pricePerDay * (nights) * 0.15)}€</span>
                    </div>
                    <div className="h-px bg-gray-200 my-2"></div>
                    <div className="flex justify-between font-bold text-haven-navy text-lg">
                      <span>Total</span>
                      <span>{(activeRoom.pricePerDay * (nights)) + (listing.cleaningFee || 0) + Math.round(activeRoom.pricePerDay * (nights) * 0.15)}€</span>
                    </div>
                  </div>

                  <Button fullWidth size="lg" onClick={handleBookClick} disabled={!activeRoom.isAvailable || !isBookableStay(startDate, endDate)}>
                    {activeRoom.isAvailable ? (startDate && endDate ? 'Réserver' : 'Sélectionnez vos dates') : 'Indisponible'}
                  </Button>
                  <p className="text-center text-xs text-gray-400 mt-4">Vous ne serez débité qu'après validation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <BookingModal 
        isOpen={isBookingOpen} 
        onClose={() => setIsBookingOpen(false)} 
        listing={listing}
        room={activeRoom}
        startDate={startDate}
        endDate={endDate}
      />

      <AccountStatusOverlay 
        isOpen={isVerificationModalOpen} 
        onClose={() => setIsVerificationModalOpen(false)} 
      />

      <ReportModal 
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        targetId={listing.id}
        targetType="LISTING"
      />
    </>
  );
};
