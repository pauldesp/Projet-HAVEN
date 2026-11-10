import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { Booking, BookingAvailability, Listing, Review } from '../types';
import { isRoomAvailableForStay } from './availability';
import { instructionsDueAt } from './reservationFulfillment';
import { departureReminderDueAt } from './reservationMail';
import { countNights, isBookableStay } from './stay';
import { AdminFinanceError, type AdminActorRef } from './adminFinancesServer';

const ID = /^[a-zA-Z0-9_-]{1,160}$/;
const text = (value: unknown, min: number, max: number, message: string) => {
  const result = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (result.length < min || result.length > max) throw new AdminFinanceError(message, 422);
  return result;
};

/** Average and count of the visible reviews, as stored on the listing or member. */
export function visibleRating(reviews: Pick<Review, 'rating' | 'hiddenByHaven'>[]) {
  const visible = reviews.filter(review => !review.hiddenByHaven && Number.isFinite(review.rating));
  return { rating: visible.length ? Math.round(visible.reduce((sum, review) => sum + review.rating, 0) / visible.length * 10) / 10 : 0, reviewsCount: visible.length };
}

export function createAdminModeration(deps: { db: Firestore; notifyMail: () => void }) {
  const { db } = deps;
  const audit = (transaction: FirebaseFirestore.Transaction, admin: AdminActorRef, action: string, category: string, targetType: string, targetId: string, summary: string) => {
    const ref = db.collection('admin_audit').doc();
    transaction.create(ref, { id: ref.id, actorId: admin.uid, actorName: admin.name, action, category, targetType, targetId, summary, createdAt: new Date().toISOString() });
  };

  /** Takes a published listing offline without deleting it, or puts it back online. */
  async function suspendListing(admin: AdminActorRef, listingId: string, suspend: unknown, reasonInput: unknown) {
    if (!ID.test(listingId) || typeof suspend !== 'boolean') throw new AdminFinanceError('Demande invalide.', 422);
    const reason = suspend ? text(reasonInput, 3, 500, 'Indiquez le motif de la suspension.') : '';
    const ref = db.collection('listings').doc(listingId);
    await db.runTransaction(async transaction => {
      const listing = (await transaction.get(ref)).data() as (Listing & { suspendedByHaven?: boolean }) | undefined;
      if (!listing) throw new AdminFinanceError('Annonce introuvable.', 404);
      if (suspend && listing.status !== 'APPROVED') throw new AdminFinanceError('Seule une annonce en ligne peut être suspendue.');
      if (!suspend && !listing.suspendedByHaven) throw new AdminFinanceError('Cette annonce n’est pas suspendue.');
      const at = new Date().toISOString();
      // A suspended listing is out of search and cannot be booked; existing stays are not affected.
      transaction.update(ref, suspend
        ? { status: 'REJECTED', suspendedByHaven: true, suspendedAt: at, rejectionReason: `Annonce suspendue par Haven : ${reason}` }
        : { status: 'APPROVED', suspendedByHaven: FieldValue.delete(), suspendedAt: FieldValue.delete(), rejectionReason: FieldValue.delete() });
      audit(transaction, admin, suspend ? 'LISTING_SUSPENDED' : 'LISTING_RESTORED', 'LISTING', 'LISTING', listingId, suspend ? `Annonce suspendue : ${reason}` : 'Annonce remise en ligne.');
    });
  }

  /** Hides an abusive review (kept for the record) and recalculates the rating of what it rated. */
  async function hideReview(admin: AdminActorRef, reviewId: string, hide: unknown, reasonInput: unknown) {
    if (!ID.test(reviewId) || typeof hide !== 'boolean') throw new AdminFinanceError('Demande invalide.', 422);
    const reason = hide ? text(reasonInput, 3, 300, 'Indiquez le motif du masquage.') : '';
    const ref = db.collection('reviews').doc(reviewId);
    await db.runTransaction(async transaction => {
      const review = (await transaction.get(ref)).data() as Review | undefined;
      if (!review) throw new AdminFinanceError('Avis introuvable.', 404);
      const targetRef = db.collection(review.targetType === 'LISTING' ? 'listings' : 'users').doc(review.targetId);
      const [siblings, target] = await Promise.all([transaction.get(db.collection('reviews').where('targetId', '==', review.targetId)), transaction.get(targetRef)]);
      const after = siblings.docs.map(doc => doc.id === reviewId ? { ...doc.data(), hiddenByHaven: hide } as Review : doc.data() as Review);
      transaction.update(ref, hide ? { hiddenByHaven: true, hiddenReason: reason, hiddenAt: new Date().toISOString() } : { hiddenByHaven: FieldValue.delete(), hiddenReason: FieldValue.delete(), hiddenAt: FieldValue.delete() });
      if (target.exists) transaction.update(targetRef, visibleRating(after));
      audit(transaction, admin, hide ? 'REVIEW_HIDDEN' : 'REVIEW_RESTORED', 'LISTING', 'REVIEW', reviewId, hide ? `Avis masqué : ${reason}` : 'Avis de nouveau visible.');
    });
  }

  /** Moves a stay to other dates or another room, same number of nights and same price. */
  async function moveBooking(admin: AdminActorRef, bookingId: string, input: { startDate?: unknown; endDate?: unknown; roomId?: unknown; reason?: unknown }) {
    if (!ID.test(bookingId)) throw new AdminFinanceError('Réservation invalide.', 422);
    const startDate = String(input.startDate || ''), endDate = String(input.endDate || ''), roomId = String(input.roomId || '');
    const reason = text(input.reason, 3, 300, 'Indiquez le motif du changement.');
    if (!isBookableStay(startDate, endDate)) throw new AdminFinanceError('Les nouvelles dates sont invalides ou passées.', 422);
    const ref = db.collection('bookings').doc(bookingId);
    const moved = await db.runTransaction(async transaction => {
      const booking = { ...(await transaction.get(ref)).data(), id: bookingId } as Booking;
      if (!booking.listingId) throw new AdminFinanceError('Réservation introuvable.', 404);
      if (!(booking.status === 'CONFIRMED' || (booking.status === 'PENDING' && booking.seriesScheduled)) || booking.checkInReportId) throw new AdminFinanceError('Seul un séjour à venir, confirmé ou réservé, peut être déplacé.');
      if (countNights(startDate, endDate) !== countNights(booking.startDate, booking.endDate)) throw new AdminFinanceError('Le nouveau séjour doit garder le même nombre de nuits (le prix reste inchangé).', 422);
      const outbox = db.collection('reservation_mail_outbox');
      const [listingSnap, availabilitySnap, receiptSnap, arrivalJob, departureJob] = await Promise.all([
        transaction.get(db.collection('listings').doc(booking.listingId)),
        transaction.get(db.collection('booking_availability').where('listingId', '==', booking.listingId)),
        transaction.get(db.collection('reservation_confirmations').doc(bookingId)),
        transaction.get(outbox.doc(`${bookingId}-ARRIVAL`)),
        transaction.get(outbox.doc(`${bookingId}-DEPARTURE_REMINDER`)),
      ]);
      const listing = listingSnap.data() as Listing | undefined;
      const room = listing?.rooms.find(item => item.id === (roomId || booking.roomId));
      if (!listing || !room) throw new AdminFinanceError('Chambre introuvable.', 404);
      const others = availabilitySnap.docs.map(doc => doc.data() as BookingAvailability).filter(item => item.bookingId !== bookingId);
      if (!isRoomAvailableForStay(room, listing, others, startDate, endDate)) throw new AdminFinanceError('La chambre n’est pas libre à ces dates.');
      const at = new Date().toISOString();
      transaction.update(ref, { startDate, endDate, roomId: room.id, roomName: room.name || 'Chambre', movedByHavenAt: at });
      transaction.set(db.collection('booking_availability').doc(bookingId), { id: bookingId, bookingId, listingId: booking.listingId, roomId: room.id, startDate, endDate, status: booking.status, updatedAt: at });
      if (receiptSnap.exists) {
        // Arrival instructions and the departure reminder follow the new dates.
        const receipt = { ...receiptSnap.data(), startDate, endDate, roomName: room.name || '' } as never as import('./reservationFulfillment').ReservationConfirmation;
        receipt.instructionsDueAt = instructionsDueAt({ startDate, checkInTime: receipt.checkInTime, paidAt: receipt.paidAt }, receipt.timeZone);
        transaction.update(receiptSnap.ref, { startDate, endDate, roomName: receipt.roomName, instructionsDueAt: receipt.instructionsDueAt });
        // Existing jobs only: the new dates are read from the confirmation when they are sent.
        if (arrivalJob.exists && arrivalJob.data()?.status !== 'SENT') transaction.update(arrivalJob.ref, { nextAttemptAt: receipt.instructionsDueAt, status: 'PENDING' });
        if (departureJob.exists && departureJob.data()?.status !== 'SENT') transaction.update(departureJob.ref, { nextAttemptAt: departureReminderDueAt(receipt), status: 'PENDING' });
      }
      audit(transaction, admin, 'BOOKING_MOVED_BY_HAVEN', 'BOOKING', 'BOOKING', bookingId, `Séjour déplacé du ${booking.startDate}–${booking.endDate} (${booking.roomName}) au ${startDate}–${endDate} (${room.name}) : ${reason}`);
      return booking;
    });
    deps.notifyMail();
    return { previous: { startDate: moved.startDate, endDate: moved.endDate, roomName: moved.roomName } };
  }

  return { suspendListing, hideReview, moveBooking };
}
