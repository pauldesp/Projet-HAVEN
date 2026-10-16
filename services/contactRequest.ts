import type { ContactRequest } from '../types';

export const CONTACT_SUBJECTS = [
  'Avis sur le site',
  'Suggestion ou conseil',
  'Dysfonctionnement du site',
  'Réclamation sur le service Haven',
  'Question générale',
  'Partenariat',
  'Autre demande'
] as const;

export function prepareContactRequest(form: Pick<ContactRequest, 'name' | 'email' | 'phone' | 'subject' | 'message'>, id: string, now = new Date().toISOString()): ContactRequest {
  const cleaned = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : ''])) as typeof form;
  if (!cleaned.name || cleaned.name.length >= 100) throw new Error('Indiquez votre nom en moins de 100 caractères.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned.email)) throw new Error('Indiquez une adresse e-mail valide.');
  if (!cleaned.phone || cleaned.phone.length >= 20) throw new Error('Indiquez un numéro de téléphone de moins de 20 caractères.');
  if (!(CONTACT_SUBJECTS as readonly string[]).includes(cleaned.subject)) throw new Error('Choisissez un motif de contact général. Les incidents du logement et les signalements disposent de leur propre formulaire.');
  if (!cleaned.message || cleaned.message.length >= 10000) throw new Error('Votre message doit contenir entre 1 et 9 999 caractères.');
  return { ...cleaned, id, timestamp: now, status: 'NEW' };
}
