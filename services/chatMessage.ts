import type { Message } from '../types';
import { createRandomId } from './randomId';

export function createChatMessage(content: string, senderId: string, receiverId: string, bookingId: string, random: Pick<Crypto, 'getRandomValues'> = globalThis.crypto): Message {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length >= 5000) throw new Error('Le message doit contenir entre 1 et 4 999 caractères.');
  return { id: `m-${createRandomId(random)}`, senderId, receiverId, bookingId, content: trimmed,
    timestamp: new Date().toISOString(), isRead: false, participants: [senderId, receiverId] };
}
