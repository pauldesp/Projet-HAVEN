export interface PlatformFeedbackInput { rating: number; comment: string; }
export interface PlatformFeedback extends PlatformFeedbackInput { id: string; bookingId: string; authorId: string; authorName: string; createdAt: string; }
export function normalizePlatformFeedback(value: unknown): PlatformFeedbackInput | undefined {
  if (value === undefined || value === null) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Avis Haven invalide.');
  const data = value as Record<string, unknown>;
  if (!Number.isInteger(data.rating) || Number(data.rating) < 1 || Number(data.rating) > 5 || typeof data.comment !== 'string' || data.comment.length > 2000) throw new Error('Pour Haven, choisissez une note de 1 à 5 et un commentaire de 2 000 caractères maximum.');
  return { rating: Number(data.rating), comment: data.comment.trim() };
}
