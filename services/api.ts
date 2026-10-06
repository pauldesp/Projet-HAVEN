
import { db, auth } from '../firebase';
import { collection, getDocs, getDoc, doc, setDoc, updateDoc, query, where, deleteField, onSnapshot, or } from 'firebase/firestore';
import { Listing, User, Booking, BookingAvailability, ListingStatus, UserStatus, Message, ContactRequest, Report, Incident, Payment, InventoryReport, AppDocument, HousematePreview, AdminAuditEntry } from '../types';
import { authenticatedFetch } from './serverApi';
import { hasMissingRoomPhoto, normalizeListingPhotos } from './media';
import { normalizeListingDescription } from './listingDescription';
import { hasIncompleteRoom, hasRoomWithoutOption } from './roomValidation';
import { reportError, userFacingErrorMessage } from './errorHandling';
import { formatScheduledMoment, getInventoryTiming } from './inventoryTiming';
import { countNights, isBookableStay } from './stay';

const toAvailability = (booking: Booking): BookingAvailability => ({
  id: booking.id,
  bookingId: booking.id,
  listingId: booking.listingId,
  roomId: booking.roomId,
  startDate: booking.startDate,
  endDate: booking.endDate,
  status: booking.status,
  updatedAt: new Date().toISOString()
});

// Helper to handle firestore errors with context
const handleFirestoreError = (error: any, operation: string, path: string) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errInfo = {
    error: errorMessage,
    operationType: (operation.toLowerCase().includes('get') || operation.toLowerCase().includes('list')) ? 'get' : 'write',
    path: path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    }
  };
  reportError(errInfo, `Firebase ${operation} ${path}`);
  throw new Error(userFacingErrorMessage(error));
};

// A real-time listener can fail transiently while a mobile browser reconnects.
// Never throw from its error callback: doing so would take down the entire UI.
const logFirestoreListenerError = (error: unknown, operation: string, path: string) => {
  reportError(error, `Écoute Firebase ${operation} ${path}`);
};

// Helper helper function to reactive cleanup expired bookings (48h manual approval, 72h manual payment)
async function cleanupAndFilterBookings(bookings: Booking[]): Promise<Booking[]> {
  const now = new Date();
  const updatedBookings: Booking[] = [];

  for (const booking of bookings) {
    let changed = false;
    let currentStatus = booking.status;

    // 1. Check PENDING manual booking (owner must validate within 48h)
    if (booking.status === 'PENDING' && booking.bookingMode === 'MANUAL') {
      const createdAtTime = new Date(booking.createdAt).getTime();
      const elapsedHours = (now.getTime() - createdAtTime) / (1000 * 60 * 60);
      if (elapsedHours > 48) {
        currentStatus = 'CANCELLED';
        changed = true;
      }
    }

    // 2. Check APPROVED manual booking (tenant must pay within 72h)
    if (booking.status === 'APPROVED' && booking.approvedAt) {
      const approvedAtTime = new Date(booking.approvedAt).getTime();
      const elapsedHours = (now.getTime() - approvedAtTime) / (1000 * 60 * 60);
      if (elapsedHours > 72 && booking.paymentStatus !== 'PAID') {
        currentStatus = 'CANCELLED';
        changed = true;
      }
    }

    if (changed) {
      try {
        await updateDoc(doc(db, 'bookings', booking.id), { status: currentStatus });
        await setDoc(doc(db, 'booking_availability', booking.id), toAvailability({ ...booking, status: currentStatus }));

        // Post automated expiration message in chat log
        const msgId = `m-${crypto.randomUUID()}`;
        const autoCancelMsg: Message = {
          id: msgId,
          senderId: booking.ownerId,
          receiverId: booking.tenantId,
          bookingId: booking.id,
          content: booking.status === 'PENDING' 
            ? `⚠️ Demande de réservation expirée (le propriétaire n'a pas répondu dans le délai requis de 48 heures).`
            : `⚠️ Demande de réservation expirée (le premier loyer n'a pas été réglé dans le délai imparti de 72 heures).`,
          timestamp: new Date().toISOString(),
          isRead: false,
          participants: [booking.tenantId, booking.ownerId]
        };
        await setDoc(doc(db, 'messages', msgId), autoCancelMsg);
        
        updatedBookings.push({ ...booking, status: currentStatus });
      } catch (e) {
        console.error("Error auto-expiring booking", booking.id, e);
        updatedBookings.push(booking);
      }
    } else {
      updatedBookings.push(booking);
    }
  }

  return updatedBookings;
}

export const apiService = {
  admin: {
    async createAdministrator(input: { email: string; firstName: string; lastName: string }) {
      const response = await authenticatedFetch('/api/admin/staff', {
        method: 'POST',
        body: JSON.stringify(input)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Erreur ${response.status}`);
      return payload.user as User;
    },
    async revokeAdministrator(userId: string) {
      const response = await authenticatedFetch(`/api/admin/staff/${encodeURIComponent(userId)}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Erreur ${response.status}`);
    },
    async listAudit(): Promise<AdminAuditEntry[]> {
      const response = await authenticatedFetch('/api/admin/audit');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Erreur ${response.status}`);
      return Array.isArray(payload.entries) ? payload.entries as AdminAuditEntry[] : [];
    },
    async recordAudit(entry: Omit<AdminAuditEntry, 'id' | 'actorId' | 'actorName' | 'createdAt'>) {
      const response = await authenticatedFetch('/api/admin/audit', {
        method: 'POST',
        body: JSON.stringify(entry)
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Erreur ${response.status}`);
      }
    }
  },
  users: {
    async getAll(): Promise<User[]> {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        return snapshot.docs.map(doc => doc.data() as User);
      } catch (e) {
        return handleFirestoreError(e, 'GET_ALL', 'users');
      }
    },
    async getById(id: string): Promise<User | undefined> {
      try {
        const userDoc = await getDoc(doc(db, 'users', id));
        return userDoc.exists() ? (userDoc.data() as User) : undefined;
      } catch (e) {
        return handleFirestoreError(e, 'GET_BY_ID', `users/${id}`);
      }
    },
    async getByIds(ids: string[]): Promise<User[]> {
      if (!ids.length) return [];
      try {
        // Firestore 'in' query is limited to 30 items
        const batches = [];
        for (let i = 0; i < ids.length; i += 30) {
          const batch = ids.slice(i, i + 30);
          const q = query(collection(db, 'users'), where('id', 'in', batch));
          batches.push(getDocs(q));
        }
        const snapshots = await Promise.all(batches);
        return snapshots.flatMap(s => s.docs.map(doc => doc.data() as User));
      } catch (e) {
        return handleFirestoreError(e, 'GET_BY_IDS', `users?ids=${ids.join(',')}`);
      }
    },
    async updateProfile(user: User) {
      try {
        await setDoc(doc(db, 'users', user.id), user);
      } catch (e) {
        handleFirestoreError(e, 'UPDATE', `users/${user.id}`);
      }
    },
    async setHousemateVisibility(shareProfileWithHousemates: boolean) {
      try {
        const response = await authenticatedFetch('/api/users/me/housemate-visibility', {
          method: 'PUT',
          body: JSON.stringify({ shareProfileWithHousemates })
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || `Erreur ${response.status}`);
        }
      } catch (e) {
        return handleFirestoreError(e, 'UPDATE_HOUSEMATE_VISIBILITY', 'users/me/housemate-visibility');
      }
    },
    async updateStatus(id: string, status: UserStatus, rejectionReason?: string) {
      try {
        const updateData: any = { status };
        if (status === 'APPROVED') {
          updateData.rejectionReason = deleteField();
        } else if (rejectionReason) {
          updateData.rejectionReason = rejectionReason;
        }
        await updateDoc(doc(db, 'users', id), updateData);
      } catch (e) {
        handleFirestoreError(e, 'UPDATE_STATUS', `users/${id}`);
      }
    },
    async toggleFavorite(userId: string, listingId: string) {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const user = userDoc.data() as User;
          const favorites = user.favorites || [];
          const newFavorites = favorites.includes(listingId)
            ? favorites.filter(id => id !== listingId)
            : [...favorites, listingId];
          await updateDoc(doc(db, 'users', userId), { favorites: newFavorites });
        }
      } catch (e) {
        handleFirestoreError(e, 'TOGGLE_FAVORITE', `users/${userId}`);
      }
    },
    async uploadDocument(userId: string, type: 'idCard' | 'proofOfAddress' | 'proofOfOwnership' | 'proofOfIncome' | 'studentCard', url: string) {
      try {
        if (type !== 'idCard') throw new Error('Seule la pièce d’identité est demandée pour le moment.');
        if (auth.currentUser?.uid !== userId) throw new Error('Vous ne pouvez transmettre que votre propre pièce d’identité.');
        const response = await authenticatedFetch('/api/users/me/identity-document', {
          method: 'POST',
          body: JSON.stringify({ documentDataUrl: url })
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || `Erreur ${response.status}`);
        }
        return response.json() as Promise<{ status: 'PENDING'; identityVerified: false }>;
      } catch (e) {
        if (e instanceof Error) throw e;
        handleFirestoreError(e, 'UPLOAD_DOCUMENT', `users/${userId}`);
      }
    },
    async updatePersonalDetails(userId: string, details: { firstName: string; lastName: string; birthDate: string; phone: string }) {
      try {
        await updateDoc(doc(db, 'users', userId), details);
      } catch (e) {
        handleFirestoreError(e, 'UPDATE_PERSONAL_DETAILS', `users/${userId}`);
      }
    },
    async submitVerification(role: 'TENANT' | 'OWNER') {
      const response = await authenticatedFetch('/api/users/me/submit-verification', {
        method: 'POST',
        body: JSON.stringify({ role })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Erreur ${response.status}`);
      }
      return response.json() as Promise<{ status: 'PENDING' }>;
    },
    async confirmEmail() {
      const response = await authenticatedFetch('/api/users/me/confirm-email', { method: 'POST', body: '{}' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Erreur ${response.status}`);
      }
      return response.json() as Promise<{ emailVerified: true; emailVerifiedAt: string }>;
    },
    async confirmPhone() {
      const response = await authenticatedFetch('/api/users/me/confirm-phone', { method: 'POST', body: '{}' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Erreur ${response.status}`);
      }
      return response.json() as Promise<{ phoneVerified: true; phoneVerifiedAt: string }>;
    },
    async verifyIdentity(userId: string) {
      try {
        await updateDoc(doc(db, 'users', userId), {
          identityVerified: true,
          idVerifiedAt: new Date().toISOString(),
          isVerified: true
        });
      } catch (e) {
        handleFirestoreError(e, 'VERIFY_IDENTITY', `users/${userId}`);
      }
    },
    async delete(id: string) {
      try {
        // In a real app, we might want to soft delete or handle related data
        // For this admin tool, we'll do a direct delete for now if requested
        // But usually we just change status to REJECTED or BANNED
        await updateDoc(doc(db, 'users', id), { status: 'REJECTED' });
      } catch (e) {
        handleFirestoreError(e, 'DELETE_USER', `users/${id}`);
      }
    }
  },

  listings: {
    async getAll() {
      try {
        const snapshot = await getDocs(collection(db, 'listings'));
        return snapshot.docs.map(doc => normalizeListingDescription(normalizeListingPhotos(doc.data() as Listing)));
      } catch (e) {
        return handleFirestoreError(e, 'GET_ALL', 'listings');
      }
    },
    async getById(id: string) {
      try {
        const userDoc = await getDoc(doc(db, 'listings', id));
        return userDoc.exists() ? normalizeListingDescription(normalizeListingPhotos(userDoc.data() as Listing)) : undefined;
      } catch (e) {
        return handleFirestoreError(e, 'GET_BY_ID', `listings/${id}`);
      }
    },
    async create(listing: Listing) {
      try {
        if (!auth.currentUser || listing.ownerId !== auth.currentUser.uid) throw new Error('Vous devez être connecté en tant que propriétaire pour créer ce logement. (Erreur 401)');
        if (hasIncompleteRoom(listing.rooms)) throw new Error('Chaque chambre doit avoir un nom, un prix par nuit et une surface.');
        if (hasRoomWithoutOption(listing.rooms)) throw new Error('Chaque chambre doit disposer d’au moins une option du cahier des charges HAVEN.');
        if (listing.galleryUrls.length < 3 || hasMissingRoomPhoto(listing.rooms)) throw new Error('Ajoutez au moins trois photos des parties communes et une photo par chambre.');
        const normalizedListing = normalizeListingDescription(normalizeListingPhotos({
          ...listing,
          // A proprietor may submit a listing, but only an administrator may publish it.
          status: 'PENDING'
        }));
        await setDoc(doc(db, 'listings', listing.id), normalizedListing);
        return normalizedListing;
      } catch (e) {
        return handleFirestoreError(e, 'CREATE', `listings/${listing.id}`);
      }
    },
    async update(listing: Listing) {
      try {
        if (!auth.currentUser || listing.ownerId !== auth.currentUser.uid) throw new Error('Vous n’êtes pas autorisé à modifier ce logement. (Erreur 403)');
        const existingSnapshot = await getDoc(doc(db, 'listings', listing.id));
        if (!existingSnapshot.exists()) throw new Error('Ce logement n’existe plus. (Erreur 404)');
        const existingListing = existingSnapshot.data() as Listing;
        if (existingListing.ownerId !== auth.currentUser.uid) throw new Error('Vous n’êtes pas autorisé à modifier ce logement. (Erreur 403)');
        if (hasIncompleteRoom(listing.rooms)) throw new Error('Chaque chambre doit avoir un nom, un prix par nuit et une surface.');
        if (hasRoomWithoutOption(listing.rooms)) throw new Error('Chaque chambre doit disposer d’au moins une option du cahier des charges HAVEN.');
        if (listing.galleryUrls.length < 3 || hasMissingRoomPhoto(listing.rooms)) throw new Error('Ajoutez au moins trois photos des parties communes et une photo par chambre.');
        const removedRoomIds = new Set((existingListing.rooms || [])
          .filter(existingRoom => !listing.rooms.some(room => room.id === existingRoom.id))
          .map(room => room.id));
        if (removedRoomIds.size > 0) {
          const availabilitySnapshot = await getDocs(query(collection(db, 'booking_availability'), where('listingId', '==', listing.id)));
          const hasActiveBooking = availabilitySnapshot.docs
            .map(item => item.data() as BookingAvailability)
            .some(item => removedRoomIds.has(item.roomId) && ['PENDING', 'APPROVED', 'CONFIRMED'].includes(item.status));
          if (hasActiveBooking) {
            throw new Error('Une chambre avec une réservation active ne peut pas être supprimée. Annulez d’abord la réservation concernée. (Erreur 409)');
          }
        }
        const normalizedListing = normalizeListingDescription(normalizeListingPhotos({
          ...listing,
          ownerId: existingListing.ownerId,
          status: existingListing.status
        }));
        await setDoc(doc(db, 'listings', listing.id), normalizedListing);
        return normalizedListing;
      } catch (e) {
        return handleFirestoreError(e, 'UPDATE', `listings/${listing.id}`);
      }
    },
    async updateStatus(id: string, status: ListingStatus, rejectionReason?: string) {
      try {
        const updateData: any = { status };
        if (status === 'APPROVED') {
          updateData.rejectionReason = deleteField();
        } else if (rejectionReason) {
          updateData.rejectionReason = rejectionReason;
        }
        await updateDoc(doc(db, 'listings', id), updateData);
      } catch (e) {
        handleFirestoreError(e, 'UPDATE_STATUS', `listings/${id}`);
      }
    },
  },

  bookings: {
    async getById(id: string): Promise<Booking | undefined> {
      try {
        const bookingDoc = await getDoc(doc(db, 'bookings', id));
        if (!bookingDoc.exists()) return undefined;
        const b = bookingDoc.data() as Booking;
        const cleaned = await cleanupAndFilterBookings([b]);
        return cleaned[0];
      } catch (e) {
        return handleFirestoreError(e, 'GET_BY_ID', `bookings/${id}`);
      }
    },
    async create(booking: Booking) {
      try {
        if (!auth.currentUser || booking.tenantId !== auth.currentUser.uid) {
          throw new Error('Vous devez être connecté pour réserver. (Erreur 401)');
        }
        const response = await authenticatedFetch('/api/bookings', {
          method: 'POST',
          body: JSON.stringify({ id: booking.id, listingId: booking.listingId, roomId: booking.roomId, startDate: booking.startDate, endDate: booking.endDate })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`${payload.error || 'Impossible de créer la réservation'} (Erreur ${response.status})`);
        return payload.booking as Booking;
      } catch (e) {
        throw e;
      }
    },
    async getByUserId(userId: string) {
      try {
        // Expired review windows are finalized idempotently on the server, even
        // if its scheduled worker was temporarily unavailable.
        try {
          await authenticatedFetch('/api/reviews/finalize-expired', { method: 'POST', body: '{}' });
        } catch (error) {
          console.warn('Automatic review catch-up will retry in the background', error);
        }
        const q = query(collection(db, 'bookings'), where('tenantId', '==', userId));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => doc.data() as Booking);
        return await cleanupAndFilterBookings(list);
      } catch (e) {
        return handleFirestoreError(e, 'GET_BOOKINGS_BY_USER', `bookings?tenantId=${userId}`);
      }
    },
    async getByListingId(listingId: string) {
      try {
        const q = query(collection(db, 'bookings'), where('listingId', '==', listingId));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => doc.data() as Booking);
        return await cleanupAndFilterBookings(list);
      } catch (e) {
        return handleFirestoreError(e, 'GET_BOOKINGS_BY_LISTING', `bookings?listingId=${listingId}`);
      }
    },
    async getByOwnerId(ownerId: string) {
      try {
        const q = query(collection(db, 'bookings'), where('ownerId', '==', ownerId));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => doc.data() as Booking);
        return await cleanupAndFilterBookings(list);
      } catch (e) {
        return handleFirestoreError(e, 'GET_BOOKINGS_BY_OWNER', `bookings?ownerId=${ownerId}`);
      }
    },
    async updateStatus(bookingId: string, status: Booking['status']) {
      try {
        if (status === 'COMPLETED') {
          const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
          if (!bookingDoc.exists()) throw new Error('Réservation introuvable.');
          const booking = bookingDoc.data() as Booking;
          const response = await authenticatedFetch(`/api/bookings/${encodeURIComponent(bookingId)}/complete`, {
            method: 'POST', body: JSON.stringify({ checkOutReportId: booking.checkOutReportId })
          });
          const result = await response.json() as { completedAt: string };
          return result.completedAt;
        }
        const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
        if (bookingDoc.exists()) {
          const booking = bookingDoc.data() as Booking;
          const previousStatus = booking.status;
          
          const updateData: any = { status };
          if (status === 'APPROVED') {
            updateData.approvedAt = new Date().toISOString();
          }
          await updateDoc(doc(db, 'bookings', bookingId), updateData);
          await setDoc(doc(db, 'booking_availability', bookingId), toAvailability({ ...booking, status }));
          
          // Automated status change messages inside chat
          if (status === 'APPROVED' && previousStatus !== 'APPROVED') {
            const msgId = `m-${crypto.randomUUID()}`;
            const approvalMessage: Message = {
              id: msgId,
              senderId: booking.ownerId,
              receiverId: booking.tenantId,
              bookingId,
              content: `Félicitations ! Votre demande de réservation pour la chambre "${booking.roomName || 'Chambre'}" a été ACCEPTÉE. Vous disposez de 72 heures pour finaliser votre premier paiement afin de bloquer définitivement votre place.`,
              timestamp: new Date().toISOString(),
              isRead: false,
              participants: [booking.tenantId, booking.ownerId]
            };
            await setDoc(doc(db, 'messages', msgId), approvalMessage);
          } else if (status === 'CONFIRMED' && previousStatus !== 'CONFIRMED') {
            const msgId = `m-${crypto.randomUUID()}`;
            const confirmationMessage: Message = {
              id: msgId,
              senderId: booking.ownerId,
              receiverId: booking.tenantId,
              bookingId,
              content: `🎉 Paiement reçu avec succès ! Votre réservation pour la chambre "${booking.roomName || 'Chambre'}" est confirmée de manière définitive. Bienvenue chez HAVEN !`,
              timestamp: new Date().toISOString(),
              isRead: false,
              participants: [booking.tenantId, booking.ownerId]
            };
            await setDoc(doc(db, 'messages', msgId), confirmationMessage);
          } else if (status === 'CANCELLED' && previousStatus !== 'CANCELLED') {
            const msgId = `m-${crypto.randomUUID()}`;
            const actorId = auth.currentUser?.uid;
            if (!actorId) throw new Error('Authentication required');
            const cancelMessage: Message = {
              id: msgId,
              senderId: actorId,
              receiverId: actorId === booking.ownerId ? booking.tenantId : booking.ownerId,
              bookingId,
              content: `La demande de réservation pour la chambre "${booking.roomName || 'Chambre'}" a été déclinée ou a expiré.`,
              timestamp: new Date().toISOString(),
              isRead: false,
              participants: [booking.tenantId, booking.ownerId]
            };
            await setDoc(doc(db, 'messages', msgId), cancelMessage);
          }

          // Booking availability is range-based. The room's general availability
          // must not be flipped for a whole period after one reservation.
        }
      } catch (e) {
        handleFirestoreError(e, 'UPDATE_BOOKING_STATUS', `bookings/${bookingId}`);
      }
    },
    async cancel(bookingId: string, reason: string) {
      const response = await authenticatedFetch(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`${payload.error || 'Annulation impossible'}${payload.code ? ` (Erreur ${payload.code})` : ''}`);
      return payload as { success: true; status: 'CANCELLED'; cancellation: NonNullable<Booking['cancellation']> };
    }
  },

  availability: {
    listenAll(callback: (items: BookingAvailability[]) => void) {
      return onSnapshot(collection(db, 'booking_availability'), snapshot => {
        callback(snapshot.docs.map(item => item.data() as BookingAvailability));
      }, error => logFirestoreListenerError(error, 'LIST_AVAILABILITY', 'booking_availability'));
    },
    listenByListingId(listingId: string, callback: (items: BookingAvailability[]) => void) {
      const q = query(collection(db, 'booking_availability'), where('listingId', '==', listingId));
      return onSnapshot(q, snapshot => {
        callback(snapshot.docs.map(item => item.data() as BookingAvailability));
      }, error => logFirestoreListenerError(error, 'LIST_AVAILABILITY', `booking_availability?listingId=${listingId}`));
    }
  },

  housemates: {
    async getForStay(listingId: string, roomId: string, startDate: string, endDate: string): Promise<HousematePreview[]> {
      try {
        const params = new URLSearchParams({ roomId, start: startDate, end: endDate });
        const response = await authenticatedFetch(`/api/listings/${encodeURIComponent(listingId)}/housemates?${params.toString()}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || `Erreur ${response.status}`);
        }
        const payload = await response.json() as { housemates?: HousematePreview[] };
        return Array.isArray(payload.housemates) ? payload.housemates : [];
      } catch (e) {
        return handleFirestoreError(e, 'GET_HOUSEMATES', `listings/${listingId}/housemates`);
      }
    }
  },

  reviews: {
    async create(review: any) {
      try {
        const response = await authenticatedFetch(`/api/bookings/${encodeURIComponent(review.bookingId)}/review`, {
          method: 'POST', body: JSON.stringify({ rating: review.rating, comment: review.comment })
        });
        return await response.json();
      } catch (e) {
        throw e;
      }
    },
    async getByAuthorId(authorId: string) {
      try {
        const q = query(collection(db, 'reviews'), where('authorId', '==', authorId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(item => item.data());
      } catch (e) {
        return handleFirestoreError(e, 'GET_REVIEWS_BY_AUTHOR', `reviews?authorId=${authorId}`);
      }
    },
    async getByTargetId(targetId: string) {
      try {
        const q = query(collection(db, 'reviews'), where('targetId', '==', targetId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data());
      } catch (e) {
        return handleFirestoreError(e, 'GET_REVIEWS_BY_TARGET', `reviews?targetId=${targetId}`);
      }
    }
  },

  messages: {
    async create(message: Message) {
      try {
        await setDoc(doc(db, 'messages', message.id), message);
        return message;
      } catch (e) {
        return handleFirestoreError(e, 'CREATE_MESSAGE', `messages/${message.id}`);
      }
    },
    async getByBookingId(bookingId: string) {
      if (!auth.currentUser) return [];
      try {
        const q = query(
          collection(db, 'messages'), 
          where('bookingId', '==', bookingId),
          where('participants', 'array-contains', auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as Message).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      } catch (e) {
        return handleFirestoreError(e, 'GET_MESSAGES_BY_BOOKING', `messages?bookingId=${bookingId}`);
      }
    },
    async markAsRead(bookingId: string, userId: string) {
      if (!userId) return;
      try {
        const q = query(
          collection(db, 'messages'),
          where('participants', 'array-contains', userId),
          where('bookingId', '==', bookingId),
          where('receiverId', '==', userId),
          where('isRead', '==', false)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;
        
        const updates = snapshot.docs.map(d => updateDoc(doc(db, 'messages', d.id), { isRead: true }));
        await Promise.all(updates);
      } catch (e) {
        console.error('Error marking messages as read:', e);
        // Important: we don't necessarily want to crash the UI for markAsRead failures, 
        // but we want to log it if it's a permission issue
        const errorMsg = e instanceof Error ? e.message : String(e);
        if (errorMsg.toLowerCase().includes('permission')) {
           handleFirestoreError(e, 'MARK_AS_READ', `messages?bookingId=${bookingId}&userId=${userId}`);
        }
      }
    },
    listenToConversations(userId: string, callback: (conversations: any[]) => void) {
      if (!userId) {
        console.warn('listenToConversations called without userId');
        return () => {};
      }
      
      console.log(`Setting up conversation listener for user: ${userId}`);
      const q = query(
        collection(db, 'messages'),
        where('participants', 'array-contains', userId)
      );

      return onSnapshot(q, (snapshot) => {
        console.log(`Received ${snapshot.docs.length} messages for user ${userId}`);
        const allMessages = snapshot.docs.map(doc => doc.data() as Message);
        
        // Group by bookingId
        const groups = new Map<string, Message[]>();
        allMessages.forEach(msg => {
          const key = msg.bookingId;
          const group = groups.get(key) || [];
          group.push(msg);
          groups.set(key, group);
        });

        const conversations = [];
        for (const [bookingId, msgs] of groups.entries()) {
          const sorted = msgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          const latest = sorted[0];
          
          if (!latest.participants) {
             console.warn(`Message ${latest.id} is missing participants array`);
             continue;
          }
          
          const otherUserId = latest.participants.find(p => p !== userId);
          
          conversations.push({
            bookingId,
            latestMessage: latest,
            otherUserId,
            unreadCount: msgs.filter(m => !m.isRead && m.receiverId === userId).length
          });
        }
        
        callback(conversations.sort((a, b) => new Date(b.latestMessage.timestamp).getTime() - new Date(a.latestMessage.timestamp).getTime()));
      }, (error) => {
        console.error('onSnapshot error in listenToConversations:', error);
        logFirestoreListenerError(error, 'LISTEN_CONVERSATIONS', `messages_inbox_${userId}`);
      });
    }
  },

  contactRequests: {
    async create(request: ContactRequest) {
      try {
        await setDoc(doc(db, 'contact_requests', request.id), request);
        return request;
      } catch (e) {
        return handleFirestoreError(e, 'CREATE_CONTACT_REQUEST', `contact_requests/${request.id}`);
      }
    },
    async getAll(): Promise<ContactRequest[]> {
      try {
        const snapshot = await getDocs(collection(db, 'contact_requests'));
        return snapshot.docs.map(doc => doc.data() as ContactRequest);
      } catch (e) {
        return handleFirestoreError(e, 'GET_ALL_CONTACT_REQUESTS', 'contact_requests');
      }
    },
    async updateStatus(id: string, status: ContactRequest['status']) {
      try {
        await updateDoc(doc(db, 'contact_requests', id), { status });
      } catch (e) {
        handleFirestoreError(e, 'UPDATE_CONTACT_STATUS', `contact_requests/${id}`);
      }
    }
  },

  reports: {
    async create(report: Report) {
      try {
        await setDoc(doc(db, 'reports', report.id), report);
        return report;
      } catch (e) {
        return handleFirestoreError(e, 'CREATE_REPORT', `reports/${report.id}`);
      }
    },
    async getAll(): Promise<Report[]> {
      try {
        const snapshot = await getDocs(collection(db, 'reports'));
        return snapshot.docs.map(doc => doc.data() as Report);
      } catch (e) {
        return handleFirestoreError(e, 'GET_ALL_REPORTS', 'reports');
      }
    },
    async updateStatus(id: string, status: Report['status'], adminNotes?: string) {
      try {
        const updateData: any = { status };
        if (adminNotes) updateData.adminNotes = adminNotes;
        await updateDoc(doc(db, 'reports', id), updateData);
      } catch (e) {
        handleFirestoreError(e, 'UPDATE_REPORT_STATUS', `reports/${id}`);
      }
    }
  },
  
  incidents: {
    async create(incident: Incident) {
      try {
        await setDoc(doc(db, 'incidents', incident.id), incident);
        return incident;
      } catch (e) {
        return handleFirestoreError(e, 'CREATE_INCIDENT', `incidents/${incident.id}`);
      }
    },
    async getByListingId(listingId: string): Promise<Incident[]> {
      if (!auth.currentUser) return [];
      try {
        const q = query(
          collection(db, 'incidents'), 
          where('listingId', '==', listingId)
        );
        const snapshot = await getDocs(q);
        // Filter in memory to avoid needing composite indexes with OR
        const incidents = snapshot.docs.map(doc => doc.data() as Incident);
        return incidents.filter(i => i.reporterId === auth.currentUser?.uid || i.ownerId === auth.currentUser?.uid);
      } catch (e) {
        return handleFirestoreError(e, 'GET_INCIDENTS_BY_LISTING', `incidents?listingId=${listingId}`);
      }
    },
    async getByOwnerId(ownerId: string): Promise<Incident[]> {
      try {
        const q = query(collection(db, 'incidents'), where('ownerId', '==', ownerId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as Incident);
      } catch (e) {
        return handleFirestoreError(e, 'GET_INCIDENTS_BY_OWNER', `incidents?ownerId=${ownerId}`);
      }
    },
    async updateStatus(id: string, status: Incident['status'], adminNotes?: string) {
      try {
        const updateData: any = { status };
        if (adminNotes) updateData.adminNotes = adminNotes;
        await updateDoc(doc(db, 'incidents', id), updateData);
      } catch (e) {
        handleFirestoreError(e, 'UPDATE_INCIDENT_STATUS', `incidents/${id}`);
      }
    }
  },

  payments: {
    async create(payment: Payment) {
      try {
        await setDoc(doc(db, 'payments', payment.id), payment);
        return payment;
      } catch (e) {
        return handleFirestoreError(e, 'CREATE_PAYMENT', `payments/${payment.id}`);
      }
    },
    async getByOwnerId(ownerId: string): Promise<Payment[]> {
      try {
        const q = query(collection(db, 'payments'), where('ownerId', '==', ownerId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as Payment);
      } catch (e) {
        return handleFirestoreError(e, 'GET_PAYMENTS_BY_OWNER', `payments?ownerId=${ownerId}`);
      }
    },
    async getByTenantId(tenantId: string): Promise<Payment[]> {
      try {
        const q = query(collection(db, 'payments'), where('tenantId', '==', tenantId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as Payment);
      } catch (e) {
        return handleFirestoreError(e, 'GET_PAYMENTS_BY_TENANT', `payments?tenantId=${tenantId}`);
      }
    }
  },
  
  settings: {
    async getAllLegalDocuments() {
      try {
        const snapshot = await getDocs(collection(db, 'settings'));
        return snapshot.docs.map(doc => doc.data() as any);
      } catch (e) {
        return handleFirestoreError(e, 'GET_ALL_LEGAL_DOCUMENTS', 'settings');
      }
    },
    listenToAllLegalDocuments(callback: (docs: any[]) => void) {
      const q = collection(db, 'settings');
      return onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => doc.data());
        callback(docs);
      }, (error) => {
        logFirestoreListenerError(error, 'LISTEN_LEGAL_DOCUMENTS', 'settings');
      });
    },
    async getLegalDocument(id: string) {
      try {
        const docRef = doc(db, 'settings', id);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : null;
      } catch (e) {
        return handleFirestoreError(e, 'GET_LEGAL_DOCUMENT', `settings/${id}`);
      }
    },
    async updateLegalDocument(id: string, title: string, content: string, userId: string) {
      try {
        const docRef = doc(db, 'settings', id);
        await setDoc(docRef, {
          id,
          title,
          content,
          lastUpdated: new Date().toISOString(),
          updatedBy: userId
        });
      } catch (e) {
        handleFirestoreError(e, 'UPDATE_LEGAL_DOCUMENT', `settings/${id}`);
      }
    }
  },

  inventory: {
    async create(report: InventoryReport) {
      try {
        if (!auth.currentUser) throw new Error('Vous devez être connecté pour réaliser un état des lieux. (Erreur 401)');
        const bookingSnap = await getDoc(doc(db, 'bookings', report.bookingId));
        if (!bookingSnap.exists()) throw new Error('Réservation introuvable.');
        const booking = bookingSnap.data() as Booking;
        if (auth.currentUser.uid !== booking.tenantId && auth.currentUser.uid !== booking.ownerId) {
          throw new Error('Vous ne participez pas à cette réservation. (Erreur 403)');
        }
        if (report.tenantId !== booking.tenantId || report.ownerId !== booking.ownerId) {
          throw new Error('Les participants de l’état des lieux ne correspondent pas à la réservation. (Erreur 422)');
        }
        if (!['CONFIRMED', 'COMPLETED'].includes(booking.status)) {
          throw new Error('L’état des lieux est disponible après la confirmation de la réservation. (Erreur 422)');
        }
        if ((report.type === 'IN' && booking.checkInReportId) || (report.type === 'OUT' && booking.checkOutReportId)) {
          throw new Error('Cet état des lieux a déjà été réalisé. (Erreur 409)');
        }
        const listingSnap = await getDoc(doc(db, 'listings', booking.listingId));
        const listing = listingSnap.exists() ? listingSnap.data() as Listing : undefined;
        const timing = getInventoryTiming(booking, listing, report.type);
        const earlyDepartureAllowed = report.type === 'OUT'
          && timing.isEarlyDeparture
          && report.isEarlyDeparture
          && (report.earlyDepartureReason?.trim().length ?? 0) >= 10;
        if (!timing.isAvailable && !earlyDepartureAllowed) {
          throw new Error(`État des lieux disponible à partir du ${formatScheduledMoment(timing.scheduledAt)}.`);
        }
        await setDoc(doc(db, 'inventory', report.id), report);
        // Link to booking
        const bookingDoc = doc(db, 'bookings', report.bookingId);
        if (report.type === 'IN') {
          await updateDoc(bookingDoc, { checkInReportId: report.id });
        } else {
          await updateDoc(bookingDoc, { checkOutReportId: report.id });
        }
        return report;
      } catch (e) {
        return handleFirestoreError(e, 'CREATE_INVENTORY', `inventory/${report.id}`);
      }
    },
    async getById(id: string): Promise<InventoryReport | undefined> {
      try {
        const docSnap = await getDoc(doc(db, 'inventory', id));
        return docSnap.exists() ? (docSnap.data() as InventoryReport) : undefined;
      } catch (e) {
        return handleFirestoreError(e, 'GET_INVENTORY', `inventory/${id}`);
      }
    },
    async getByBookingId(bookingId: string): Promise<InventoryReport[]> {
      if (!auth.currentUser) return [];
      try {
        const q = query(
          collection(db, 'inventory'), 
          where('bookingId', '==', bookingId)
        );
        const snapshot = await getDocs(q);
        const reports = snapshot.docs.map(doc => doc.data() as InventoryReport);
        return reports.filter(r => r.tenantId === auth.currentUser?.uid || r.ownerId === auth.currentUser?.uid);
      } catch (e) {
        return handleFirestoreError(e, 'GET_INVENTORY_BY_BOOKING', `inventory?bookingId=${bookingId}`);
      }
    }
  },

  documents: {
    async create(document: AppDocument) {
      try {
        await setDoc(doc(db, 'documents', document.id), document);
        return document;
      } catch (e) {
        return handleFirestoreError(e, 'CREATE_DOCUMENT', `documents/${document.id}`);
      }
    },
    async getByUserId(userId: string): Promise<AppDocument[]> {
      try {
        const q = query(collection(db, 'documents'), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as AppDocument).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } catch (e) {
        return handleFirestoreError(e, 'GET_DOCUMENTS_BY_USER', `documents?userId=${userId}`);
      }
    },
    listenToByUserId(userId: string, callback: (docs: AppDocument[]) => void) {
      const q = query(collection(db, 'documents'), where('userId', '==', userId));
      return onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => doc.data() as AppDocument)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(docs);
      }, (error) => {
        logFirestoreListenerError(error, 'LISTEN_DOCUMENTS_BY_USER', `documents?userId=${userId}`);
      });
    }
  },

  notifications: {
    async sendBookingNotification(email: string, type: 'REQUEST_SUBMITTED' | 'REQUEST_APPROVED' | 'PAYMENT_CONFIRMED' | 'BOOKING_CANCELLED', details: {
      listingTitle: string;
      roomName: string;
      amount: number;
      startDate: string;
      endDate: string;
      arrivalTime?: string;
      departureTime?: string;
      tenantName: string;
      ownerName: string;
      bookingId: string;
    }) {
      try {
        const response = await authenticatedFetch('/api/send-booking-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, type, details })
        });
        return await response.json();
      } catch (e) {
        console.error("Error triggering booking notification email", e);
        return { success: false, error: e };
      }
    }
  }
};
