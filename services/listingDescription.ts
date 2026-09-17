import { Listing } from '../types';

export const MAX_LISTING_DESCRIPTION_LENGTH = 500;

export function limitListingDescription(description: string): string {
  const normalized = description.trim();
  if (normalized.length <= MAX_LISTING_DESCRIPTION_LENGTH) return normalized;

  const excerpt = normalized.slice(0, MAX_LISTING_DESCRIPTION_LENGTH - 1);
  const lastWordBoundary = excerpt.lastIndexOf(' ');
  const readableExcerpt = lastWordBoundary > 350 ? excerpt.slice(0, lastWordBoundary) : excerpt;
  return `${readableExcerpt.trimEnd()}…`;
}

export function normalizeListingDescription(listing: Listing): Listing {
  return { ...listing, description: limitListingDescription(listing.description || '') };
}
