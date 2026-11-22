import { Listing } from '../types';

/** Size of the photo as chosen (a phone photo weighs 3 to 8 MB); it is recompressed to about 45 KB afterwards. */
export const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
export const IMAGE_TOO_LARGE_MESSAGE = 'Cette photo dépasse 20 Mo. Choisissez une photo plus légère.';
const MAX_STORED_IMAGE_BYTES = 45 * 1024;

function dataUrlSize(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.ceil((base64.length * 3) / 4);
}

async function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    // HEIC photos (iPhone) open in Safari but not in every browser.
    image.onerror = () => reject(new Error('Cette photo ne peut pas être lue. Choisissez une photo JPG, PNG ou WebP.'));
    image.src = source;
  });
}

/** WebP is about 30 % lighter than JPEG at equal quality; browsers that cannot encode it (older Safari) fall back to JPEG. */
let webpEncoding: boolean | undefined;
function canEncodeWebp() {
  if (webpEncoding === undefined) {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    webpEncoding = probe.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpEncoding;
}

async function compressImageSource(source: string): Promise<string> {
  const image = await loadImage(source);
  let latest = source;
  const format = canEncodeWebp() ? 'image/webp' : 'image/jpeg';

  // Same storage budget either way; WebP stays sharper at that weight.
  for (const maxDimension of [960, 800, 640, 512]) {
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.76, 0.62, 0.5, 0.4]) {
      latest = canvas.toDataURL(format, quality);
      if (dataUrlSize(latest) <= MAX_STORED_IMAGE_BYTES) return latest;
    }
  }

  return latest;
}

export async function prepareImageForStorage(file: File, maxUploadBytes = MAX_IMAGE_UPLOAD_BYTES): Promise<string> {
  if (file.size > maxUploadBytes) throw new Error(maxUploadBytes === MAX_IMAGE_UPLOAD_BYTES ? IMAGE_TOO_LARGE_MESSAGE : 'Image trop volumineuse.');
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
