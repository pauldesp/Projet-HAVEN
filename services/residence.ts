export interface Residence { address: string; postalCode: string; city: string; country: string }
export function normalizeResidence(input: unknown): Residence {
  const data = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const result = Object.fromEntries(['address', 'postalCode', 'city', 'country'].map(key => [key, typeof data[key] === 'string' ? data[key].trim() : ''])) as unknown as Residence;
  if (!result.address || result.address.length > 200 || !result.postalCode || result.postalCode.length > 20 || !result.city || result.city.length > 100 || !result.country || result.country.length > 100) throw new Error('Renseignez une adresse, un code postal, une commune et un pays valides.');
  return result;
}
export function hasRequiredResidence(profile: { residenceProvided?: unknown; documents?: { proofOfAddress?: unknown } | null }) {
  return profile.residenceProvided === true && typeof profile.documents?.proofOfAddress === 'string' && profile.documents.proofOfAddress.length > 0;
}
export function validResidenceDocument(value: unknown): value is string {
  return typeof value === 'string' && /^data:(image\/(jpeg|png)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length <= 850 * 1024;
}
