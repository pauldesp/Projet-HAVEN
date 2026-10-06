const MAX_SOURCE_SIZE = 10 * 1024 * 1024;
const MAX_STORED_SIZE = 600 * 1024;

const readAsDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Lecture du document impossible.'));
  reader.onerror = () => reject(new Error('Lecture du document impossible.'));
  reader.readAsDataURL(blob);
});

const canvasBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Compression de l’image impossible.')), 'image/jpeg', quality);
});

/**
 * Firestore stores the document on the user profile, whose total document size
 * is limited. Accept larger phone photos, normalize them to a readable JPEG,
 * then keep the encoded value safely below that limit.
 */
export async function prepareVerificationDocument(file: File): Promise<string> {
  if (file.size > MAX_SOURCE_SIZE) throw new Error('Le fichier dépasse la limite de 10 Mo.');

  if (file.type === 'application/pdf') {
    if (file.size > MAX_STORED_SIZE) {
      throw new Error('Pour le moment, les PDF doivent faire au maximum 600 Ko. Pour une pièce plus lourde, envoyez une photo JPG ou PNG : elle sera optimisée automatiquement.');
    }
    return readAsDataUrl(file);
  }
  if (!file.type.startsWith('image/')) throw new Error('Choisissez une photo JPG ou PNG, ou un PDF.');

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('Cette image ne peut pas être lue. Essayez une photo JPG ou PNG.');
  }

  try {
    const longestSide = Math.max(bitmap.width, bitmap.height);
    let scale = Math.min(1, 2200 / longestSide);
    let canvas = document.createElement('canvas');
    let context: CanvasRenderingContext2D | null = null;
    let compressed: Blob;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context = canvas.getContext('2d');
      if (!context) throw new Error('Préparation de la photo impossible.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const quality = Math.max(0.58, 0.86 - attempt * 0.045);
      compressed = await canvasBlob(canvas, quality);
      if (compressed.size <= MAX_STORED_SIZE) return readAsDataUrl(compressed);
      scale *= 0.82;
    }
    throw new Error('La photo ne peut pas être optimisée suffisamment. Essayez une image moins grande ou un PDF de 600 Ko maximum.');
  } finally {
    bitmap.close();
  }
}
