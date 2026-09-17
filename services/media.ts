import { Listing, Room } from '../types';

export const MAX_LISTING_PHOTOS = 5;
export const MAX_ROOM_PHOTOS = 1;

export function getListingPhotoUrls(listing: Pick<Listing, 'mainPhotoUrl' | 'galleryUrls'>): string[] {
  const galleryUrls = (listing.galleryUrls || []).filter(Boolean);
  if (galleryUrls.length && galleryUrls[0] === listing.mainPhotoUrl) {
    return galleryUrls.slice(0, MAX_LISTING_PHOTOS);
  }
  return [listing.mainPhotoUrl, ...galleryUrls].filter(Boolean).slice(0, MAX_LISTING_PHOTOS);
}

export function normalizeRoomPhotos(room: Room): Room {
  const photos = (room.roomPhotos || []).filter(Boolean).slice(0, MAX_ROOM_PHOTOS);
  const photoUrl = photos[0] || room.photoUrl;
  return { ...room, photoUrl, roomPhotos: photoUrl ? [photoUrl] : [] };
}

export function normalizeListingPhotos(listing: Listing): Listing {
  const galleryUrls = getListingPhotoUrls(listing);
  return {
    ...listing,
    mainPhotoUrl: galleryUrls[0] || listing.mainPhotoUrl,
    galleryUrls,
    rooms: listing.rooms.map(normalizeRoomPhotos)
  };
}

export function hasMissingRoomPhoto(rooms: Pick<Room, 'photoUrl' | 'roomPhotos'>[]): boolean {
  return rooms.some(room => !(room.roomPhotos?.[0] || room.photoUrl));
}
