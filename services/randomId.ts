/** getRandomValues remains available on the local HTTP preview used by the iPad. */
export function createRandomId(random: Pick<Crypto, 'getRandomValues'> = globalThis.crypto): string {
  const bytes = random.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
