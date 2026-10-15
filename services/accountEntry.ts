import { isValidPhoneForVerification, normalizePhoneForVerification } from './phoneVerification';

export function normalizeAccountIdentifier(value: unknown): { kind: 'email' | 'phone'; value: string } {
  if (typeof value !== 'string' || value.length > 254) throw new Error('Saisissez un e-mail ou un numéro de téléphone valide.');
  const trimmed = value.trim();
  if (trimmed.includes('@')) {
    const email = trimmed.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Saisissez une adresse e-mail valide.');
    return { kind: 'email', value: email };
  }
  const phone = normalizePhoneForVerification(trimmed);
  if (!isValidPhoneForVerification(phone)) throw new Error('Saisissez un numéro de téléphone valide.');
  return { kind: 'phone', value: phone };
}

export async function resolveAccountEntry(
  input: unknown,
  lookup: { email: (value: string) => Promise<unknown>; phone: (value: string) => Promise<unknown> }
): Promise<{ identifier: string; kind: 'email' | 'phone'; exists: boolean }> {
  const identifier = normalizeAccountIdentifier(input);
  try {
    await lookup[identifier.kind](identifier.value);
    return { identifier: identifier.value, kind: identifier.kind, exists: true };
  } catch (error) {
    // A failed lookup must never be mistaken for a new account.
    if ((error as { code?: string })?.code !== 'auth/user-not-found') throw error;
    return { identifier: identifier.value, kind: identifier.kind, exists: false };
  }
}
