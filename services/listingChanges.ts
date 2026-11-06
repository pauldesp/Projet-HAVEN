import type { Listing } from '../types';

const CONTENT_FIELDS = ['title', 'description', 'address', 'city', 'postalCode', 'neighborhood', 'type', 'mainPhotoUrl', 'galleryUrls'] as const;
const roomContent = (listing: Pick<Listing, 'rooms'>) => (listing.rooms || []).map(room => ({ id: room.id, name: room.name, photoUrl: room.photoUrl, photos: (room as { photos?: unknown }).photos ?? null }));

/**
 * Texts, photos and address of a published listing are what Haven checked.
 * Prices, availability, rules and blocked dates can change without a new review.
 */
export function needsNewReview(before: Listing, after: Listing): boolean {
  if (before.status !== 'APPROVED') return false;
  const fieldsChanged = CONTENT_FIELDS.some(field => JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null));
  return fieldsChanged || JSON.stringify(roomContent(before)) !== JSON.stringify(roomContent(after));
}
