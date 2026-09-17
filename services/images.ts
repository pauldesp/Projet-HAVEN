import { Listing } from '../types';

export const MAX_IMAGE_UPLOAD_BYTES = 1.2 * 1024 * 1024;
const MAX_STORED_IMAGE_BYTES = 45 * 1024;

function dataUrlSize(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.ceil((base64.length * 3) / 4);
}

async function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image illisible.'));
    image.src = source;
  });
}

async function compressImageSource(source: string): Promise<string> {
  const image = await loadImage(source);
  let latest = source;

  for (const maxDimension of [960, 800, 640, 512]) {
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.76, 0.62, 0.5, 0.4]) {
      latest = canvas.toDataURL('image/jpeg', quality);
      if (dataUrlSize(latest) <= MAX_STORED_IMAGE_BYTES) return latest;
    }
  }

  return latest;
}

export async function prepareImageForStorage(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) throw new Error('Image trop volumineuse.');
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Lecture de l’image impossible.'));
    reader.readAsDataURL(file);
  });
  return compressImageSource(source);
}

export async function optimizeListingImages(listing: Listing): Promise<Listing> {
  const optimize = (source: string) => source.startsWith('data:image/') ? compressImageSource(source) : Promise.resolve(source);
  const galleryUrls = await Promise.all(listing.galleryUrls.map(optimize));
  const rooms = await Promise.all(listing.rooms.map(async room => {
    const photoUrl = await optimize(room.roomPhotos?.[0] || room.photoUrl || '');
    return { ...room, photoUrl, roomPhotos: photoUrl ? [photoUrl] : [] };
  }));
  return { ...listing, mainPhotoUrl: galleryUrls[0] || listing.mainPhotoUrl, galleryUrls, rooms };
}
