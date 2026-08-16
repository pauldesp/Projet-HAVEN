
import { db, auth } from '../firebase';
import { collection, getDocs, getDoc, doc, setDoc, updateDoc, query, where, deleteField, onSnapshot, or } from 'firebase/firestore';
import { Listing, User, Booking, ListingStatus, UserStatus, Message, ContactRequest, Report, Incident, Payment, InventoryReport, AppDocument } from '../types';

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
  console.error(`Firestore Error [${operation}]:`, JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
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

        // Release room if it was previously locked (i.e. status was APPROVED)
        if (booking.status === 'APPROVED' && currentStatus === 'CANCELLED') {
          const listingDoc = await getDoc(doc(db, 'listings', booking.listingId));
          if (listingDoc.exists()) {
            const listing = listingDoc.data() as Listing;
            const updatedRooms = listing.rooms.map(r => r.id === booking.roomId ? { ...r, isAvailable: true } : r);
            await updateDoc(doc(db, 'listings', booking.listingId), { 
              rooms: updatedRooms,
              availableRooms: Math.min(listing.totalRooms, listing.availableRooms + 1)
            });
          }
        }
        
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
    async uploadDocument(userId: string, type: 'idCard' | 'proofOfIncome' | 'studentCard', url: string) {
      try {
        const field = `documents.${type}`;
        await updateDoc(doc(db, 'users', userId), { [field]: url });
      } catch (e) {
        handleFirestoreError(e, 'UPLOAD_DOCUMENT', `users/${userId}`);
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
        return snapshot.docs.map(doc => doc.data() as Listing);
      } catch (e) {
        return handleFirestoreError(e, 'GET_ALL', 'listings');
      }
    },
    async getById(id: string) {
      try {
        const userDoc = await getDoc(doc(db, 'listings', id));
        return userDoc.exists() ? (userDoc.data() as Listing) : undefined;
      } catch (e) {
        return handleFirestoreError(e, 'GET_BY_ID', `listings/${id}`);
      }
    },
    async create(listing: Listing) {
      try {
        await setDoc(doc(db, 'listings', listing.id), listing);
        return listing;
      } catch (e) {
        return handleFirestoreError(e, 'CREATE', `listings/${listing.id}`);
      }
    },
    async update(listing: Listing) {
      try {
        await setDoc(doc(db, 'listings', listing.id), listing);
        return listing;
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
    async submitReview(listingId: string, rating: number) {
      try {
        const listingDoc = await getDoc(doc(db, 'listings', listingId));
        if (listingDoc.exists()) {
          const listing = listingDoc.data() as Listing;
          const newCount = (listing.reviewsCount || 0) + 1;
          const newRating = Number((((listing.rating || 0) * (listing.reviewsCount || 0) + rating) / newCount).toFixed(1));
          await updateDoc(doc(db, 'listings', listingId), { rating: newRating, reviewsCount: newCount });
        }
      } catch (e) {
        handleFirestoreError(e, 'SUBMIT_REVIEW', `listings/${listingId}`);
      }
    }
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
        await setDoc(doc(db, 'bookings', booking.id), booking);
        
        // Dynamic chat message creation based on booking mode
        const msgId = `m-${crypto.randomUUID()}`;
        if (booking.bookingMode === 'MANUAL') {
          const initialMessage: Message = {
            id: msgId,
            senderId: booking.tenantId,
            receiverId: booking.ownerId,
            bookingId: booking.id,
            content: `Bonjour, j'ai introduit une demande de colocation pour la chambre "${booking.roomName || 'Chambre'}" du ${new Date(booking.startDate).toLocaleDateString()} au ${new Date(booking.endDate).toLocaleDateString()}. Merci de valider ma demande sous 48 heures.`,
            timestamp: new Date().toISOString(),
            isRead: false,
            participants: [booking.tenantId, booking.ownerId]
          };
          await setDoc(doc(db, 'messages', msgId), initialMessage);
        } else {
          // Instant booking
          const initialMessage: Message = {
            id: msgId,
            senderId: booking.ownerId, // simulated as welcoming message from owner
            receiverId: booking.tenantId,
            bookingId: booking.id,
            content: `Félicitations ! Votre réservation instantanée pour la chambre "${booking.roomName || 'Chambre'}" du ${new Date(booking.startDate).toLocaleDateString()} au ${new Date(booking.endDate).toLocaleDateString()} est confirmée de manière définitive. Bienvenue ! 🏡`,
            timestamp: new Date().toISOString(),
            isRead: false,
            participants: [booking.tenantId, booking.ownerId]
          };
          await setDoc(doc(db, 'messages', msgId), initialMessage);
        }

        // Update listing availability ONLY if it's an INSTANT booking,
        // because for MANUAL bookings, room locking is deferred until the owner's APPROVAL.
        if (booking.bookingMode !== 'MANUAL') {
          const listingDoc = await getDoc(doc(db, 'listings', booking.listingId));
          if (listingDoc.exists()) {
            const listing = listingDoc.data() as Listing;
            const updatedRooms = listing.rooms.map(r => 
              r.id === booking.roomId ? { ...r, isAvailable: false } : r
            );
            await updateDoc(doc(db, 'listings', booking.listingId), { 
              rooms: updatedRooms,
              availableRooms: Math.max(0, listing.availableRooms - 1)
            });
          }
        }
        return booking;
      } catch (e) {
        return handleFirestoreError(e, 'CREATE_BOOKING', `bookings/${booking.id}`);
      }
    },
    async getByUserId(userId: string) {
      try {
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
        const bookingDoc = await getDoc(doc(db, 'bookings', bookingId));
        if (bookingDoc.exists()) {
          const booking = bookingDoc.data() as Booking;
          const previousStatus = booking.status;
          
          const updateData: any = { status };
          if (status === 'APPROVED') {
            updateData.approvedAt = new Date().toISOString();
          }
          await updateDoc(doc(db, 'bookings', bookingId), updateData);
          
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
            const cancelMessage: Message = {
              id: msgId,
              senderId: booking.ownerId,
              receiverId: booking.tenantId,
              bookingId,
              content: `La demande de réservation pour la chambre "${booking.roomName || 'Chambre'}" a été déclinée ou a expiré.`,
              timestamp: new Date().toISOString(),
              isRead: false,
              participants: [booking.tenantId, booking.ownerId]
            };
            await setDoc(doc(db, 'messages', msgId), cancelMessage);
          }

          // Lock room when manual booking is approved
          if (status === 'APPROVED' && previousStatus !== 'APPROVED') {
             const listingDoc = await getDoc(doc(db, 'listings', booking.listingId));
             if (listingDoc.exists()) {
                const listing = listingDoc.data() as Listing;
                const updatedRooms = listing.rooms.map(r => r.id === booking.roomId ? { ...r, isAvailable: false } : r);
                await updateDoc(doc(db, 'listings', booking.listingId), { 
                  rooms: updatedRooms,
                  availableRooms: Math.max(0, listing.availableRooms - 1)
                });
             }
          }
          
          // Release room on cancellation or completion
          if (status === 'COMPLETED' || status === 'CANCELLED') {
             const wasLocked = booking.bookingMode !== 'MANUAL' || previousStatus === 'APPROVED' || previousStatus === 'CONFIRMED';
             if (wasLocked) {
                const listingDoc = await getDoc(doc(db, 'listings', booking.listingId));
                if (listingDoc.exists()) {
                   const listing = listingDoc.data() as Listing;
                   const updatedRooms = listing.rooms.map(r => r.id === booking.roomId ? { ...r, isAvailable: true } : r);
                   await updateDoc(doc(db, 'listings', booking.listingId), { 
                     rooms: updatedRooms,
                     availableRooms: Math.min(listing.totalRooms, listing.availableRooms + 1)
                   });
                }
             }
          }
        }
      } catch (e) {
        handleFirestoreError(e, 'UPDATE_BOOKING_STATUS', `bookings/${bookingId}`);
      }
    }
  },

  reviews: {
    async create(review: any) {
      try {
        await setDoc(doc(db, 'reviews', review.id), review);
        return review;
      } catch (e) {
        return handleFirestoreError(e, 'CREATE_REVIEW', `reviews/${review.id}`);
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
        handleFirestoreError(error, 'LISTEN_CONVERSATIONS', `messages_inbox_${userId}`);
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
        handleFirestoreError(error, 'LISTEN_LEGAL_DOCUMENTS', 'settings');
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
        handleFirestoreError(error, 'LISTEN_DOCUMENTS_BY_USER', `documents?userId=${userId}`);
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
      tenantName: string;
      ownerName: string;
      bookingId: string;
    }) {
      try {
        const response = await fetch('/api/send-booking-notification', {
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
