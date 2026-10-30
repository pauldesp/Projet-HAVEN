import { CLEANING_POLICY_VERSION } from './cleaningPolicy';
import type { Listing, User } from '../types';
import { isAccountVerificationComplete } from './profileVerification';
import { hasIncompleteRoom, hasRoomWithoutOption } from './roomValidation';
import { getListingPhotoUrls, hasMissingRoomPhoto } from './media';

export class ListingReviewError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}

export function prepareListingReview(listing: Listing, owner: User | undefined, decision: unknown, reviewed: unknown, reason: unknown, actorId: string, now = new Date().toISOString(), trustedOwnerException = false) {
  if (decision !== 'APPROVED' && decision !== 'REJECTED') throw new ListingReviewError('Décision invalide.');
  if (listing.status === 'DRAFT') throw new ListingReviewError('Le propriétaire doit d’abord transmettre son annonce pour examen.');
  if (decision === 'APPROVED') {
    if (listing.cleaningPolicyVersion !== CLEANING_POLICY_VERSION) throw new ListingReviewError('Le propriétaire doit confirmer son engagement de ménage hebdomadaire dans les informations de son annonce.');
    if (reviewed !== true) throw new ListingReviewError('Confirmez le contrôle des informations et des photos avant validation.');
    if (!owner || (owner.role !== 'ADMIN' && (!['OWNER', 'TENANT'].includes(owner.role) || !isAccountVerificationComplete({ ...owner, verificationException: trustedOwnerException ? owner.verificationException : null })))) throw new ListingReviewError('Le compte propriétaire doit être validé avant la publication de son annonce.');
    if (!listing.title?.trim() || !listing.description?.trim() || !listing.address?.trim() || !listing.city?.trim()) throw new ListingReviewError('Le titre, la description et l’adresse du logement doivent être renseignés.');
    if (!Array.isArray(listing.rooms) || !listing.rooms.length || listing.rooms.length !== listing.totalRooms || hasIncompleteRoom(listing.rooms) || listing.rooms.some(room => !Number.isFinite(room.pricePerDay) || !Number.isFinite(room.size)) || hasRoomWithoutOption(listing.rooms)) throw new ListingReviewError('Vérifiez les chambres : nom, tarif, surface et au moins une option sont obligatoires.');
    if (getListingPhotoUrls(listing).length < 3 || hasMissingRoomPhoto(listing.rooms)) throw new ListingReviewError('Trois photos du logement et une photo par chambre sont nécessaires.');
  } else if (typeof reason !== 'string' || !reason.trim() || reason.length > 2000) {
    throw new ListingReviewError('Un motif de 1 à 2 000 caractères est obligatoire pour refuser l’annonce.');
  }
  return { verificationException: null, status: decision, rejectionReason: decision === 'REJECTED' ? (reason as string).trim() : null, reviewedBy: actorId, reviewedAt: now };
}
