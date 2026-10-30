import type { User } from '../types';

export const ACTIVITIES = { STUDENT: 'Étudiant', EMPLOYED: 'Actif', SELF_EMPLOYED: 'Indépendant', TRAINING: 'En formation', JOB_SEEKER: 'En recherche d’emploi', RETIRED: 'Retraité', OTHER: 'Autre' } as const;
export const INTERESTS = [
  'Voyages', 'Cuisine', 'Sport', 'Musique', 'Cinéma', 'Lecture', 'Nature',
  'Randonnée', 'Art', 'Photographie', 'Jeux de société', 'Jeux vidéo',
  'Technologie', 'Bien-être', 'Engagement associatif', 'Découvertes culturelles',
  'Course à pied', 'Vélo', 'Natation', 'Fitness', 'Yoga', 'Pilates',
  'Football', 'Basketball', 'Rugby', 'Tennis', 'Padel', 'Badminton',
  'Escalade', 'Surf', 'Voile', 'Plongée', 'Ski et snowboard', 'Équitation',
  'Danse', 'Théâtre', 'Concerts', 'Festivals', 'Musées et expositions',
  'Dessin et peinture', 'Écriture', 'Chant', 'Pratique d’un instrument',
  'Séries', 'Mangas et BD', 'Podcasts', 'Langues étrangères', 'Histoire',
  'Sciences', 'Astronomie', 'Architecture', 'Design', 'Mode',
  'Pâtisserie', 'Gastronomie', 'Jardinage', 'Bricolage', 'Couture',
  'Décoration', 'Écologie', 'Animaux', 'Méditation', 'Camping',
  'Road trips', 'Échecs', 'Entrepreneuriat', 'Informatique'
] as const;
export type Activity = keyof typeof ACTIVITIES;
export function profileAge(birthDate: unknown, today = new Date()) {
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return undefined;
  const birth = new Date(`${birthDate}T12:00:00Z`);
  if (!Number.isFinite(birth.getTime()) || birth.toISOString().slice(0, 10) !== birthDate) return undefined;
  let age = today.getFullYear() - birth.getUTCFullYear();
  if (today.getMonth() < birth.getUTCMonth() || (today.getMonth() === birth.getUTCMonth() && today.getDate() < birth.getUTCDate())) age--;
  return age >= 18 && age <= 120 ? age : undefined;
}
export function profileActivity(profile: { activity?: unknown; school?: unknown; job?: unknown }) {
  const school = typeof profile.school === 'string' ? profile.school.trim().slice(0, 100) : '';
  const job = typeof profile.job === 'string' ? profile.job.trim().slice(0, 100) : '';
  if (typeof profile.activity === 'string' && Object.hasOwn(ACTIVITIES, profile.activity)) {
    const label = ACTIVITIES[profile.activity as Activity];
    const detail = profile.activity === 'STUDENT' || profile.activity === 'TRAINING' ? school : profile.activity === 'EMPLOYED' || profile.activity === 'SELF_EMPLOYED' ? job : '';
    return detail ? `${label} · ${detail}` : label;
  }
  return school ? `Étudiant · ${school}` : job || undefined;
}
export const profileInterests = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === 'string' && (INTERESTS as readonly string[]).includes(item)))].slice(0, 8) : [];
export function publicTenantProfile(user: User, today = new Date()) {
  return { id: user.id, firstName: user.firstName, role: user.role, age: profileAge(user.birthDate, today), activityLabel: profileActivity(user), interests: profileInterests(user.interests) };
}
export function validateCommunityProfile(input: Record<string, unknown>) {
  if (typeof input.activity !== 'string' || !Object.hasOwn(ACTIVITIES, input.activity)) throw new Error('Choisissez votre activité.');
  const activity = input.activity as Activity;
  const school = typeof input.school === 'string' ? input.school.trim() : '';
  const job = typeof input.job === 'string' ? input.job.trim() : '';
  if (school.length > 100 || job.length > 100) throw new Error('Limitez les précisions à 100 caractères.');
  if (['STUDENT', 'TRAINING'].includes(activity) && !school) throw new Error('Précisez votre école ou votre organisme de formation.');
  if (['EMPLOYED', 'SELF_EMPLOYED'].includes(activity) && !job) throw new Error('Précisez votre domaine d’activité.');
  if (!Array.isArray(input.interests) || input.interests.length > 8 || input.interests.some(item => !(INTERESTS as readonly unknown[]).includes(item))) throw new Error('Choisissez jusqu’à 8 centres d’intérêt dans la liste.');
  return { activity, school: ['STUDENT', 'TRAINING'].includes(activity) ? school : '', job: ['EMPLOYED', 'SELF_EMPLOYED'].includes(activity) ? job : '', interests: profileInterests(input.interests) };
}
