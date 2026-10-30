export const CLEANING_POLICY_VERSION = 'haven-cleaning-2026-10-26';
export const OWNER_CLEANING_RULE = 'Le propriétaire s’engage à ce qu’un ménage hebdomadaire soit effectué, par lui-même ou par un prestataire, afin de maintenir un bon niveau d’entretien du logement dans la durée.';
export const TENANT_CLEANING_RULE = 'Avant de partir, prenez quelques instants pour laisser votre chambre propre et rangée, retirer vos affaires et vos déchets, et nettoyer les espaces communs que vous avez utilisés. Ces gestes simples permettent au prochain locataire d’arriver dans de bonnes conditions, comme vous aimeriez les trouver à votre arrivée.';
export const CHECKOUT_ROOM_TASKS = {
  private_clean: 'J’ai aspiré ou balayé, puis nettoyé le sol de ma chambre',
  private_surfaces: 'J’ai nettoyé les surfaces, le bureau et les rangements utilisés',
  private_empty: 'J’ai retiré mes affaires de la chambre et des rangements',
  private_bedding: 'J’ai retiré la parure de lit et l’ai placée dans le sac prévu à cet effet',
  private_bin: 'J’ai retiré tous les déchets de ma chambre',
} as const;
export const CHECKOUT_COMMON_TASKS = {
  kitchen_clean: 'J’ai lavé et rangé ma vaisselle et nettoyé l’évier après utilisation',
  kitchen_appliances: 'J’ai nettoyé le plan de travail, les plaques et les appareils que j’ai utilisés',
  food_removed: 'J’ai retiré mes aliments du réfrigérateur et des placards, sans toucher à ceux des autres',
  common_clean: 'J’ai rangé mes objets et nettoyé les espaces communs que j’ai utilisés',
  bathroom_clean: 'J’ai nettoyé la douche, le lavabo et les sanitaires après mon utilisation',
  waste_removed: 'J’ai évacué mes déchets et respecté les consignes de tri du logement',
} as const;
export const CHECKOUT_TASK_LABELS = { ...CHECKOUT_ROOM_TASKS, ...CHECKOUT_COMMON_TASKS, safety_closed: 'J’ai éteint mes équipements et sécurisé les accès selon les consignes du logement', no_new_damage: 'Je n’ai constaté aucune nouvelle dégradation non signalée', keys_deposited: 'Les clés ont été déposées à l’emplacement prévu' } as const;
export function assertCleaningPolicyAccepted(version: unknown) {
  if (version !== CLEANING_POLICY_VERSION) throw new Error('Confirmez les engagements de ménage avant de continuer.');
}
export function assertDetailedCheckout(data: any) {
  const required = [...Object.keys(CHECKOUT_ROOM_TASKS), ...Object.keys(CHECKOUT_COMMON_TASKS), 'safety_closed', 'keys_deposited'];
  if (!data || data.cleaningPolicyVersion !== CLEANING_POLICY_VERSION || required.some(key => data.checklist?.[key] !== true)) throw new Error('Terminez les contrôles détaillés de nettoyage et de restitution avant de valider le départ.');
  for (const [category, count] of [['ROOM', 2], ['KITCHEN', 1], ['COMMONS', 1], ['BATHROOM', 1], ['KEYS', 1]] as const) {
    const photos = data.photos?.[category];
    if (!Array.isArray(photos) || photos.length < count || photos.length > 2 || photos.some((photo: unknown) => typeof photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo))) throw new Error('Ajoutez les photos de départ demandées pour chaque espace, y compris les sanitaires.');
  }
  for (const [category, photos] of Object.entries(data.photos || {})) {
    if (!['ROOM', 'KITCHEN', 'COMMONS', 'BATHROOM', 'KEYS', 'DAMAGE'].includes(category) || !Array.isArray(photos) || photos.length > 2 || photos.some(photo => typeof photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo))) throw new Error('Les photos de départ sont invalides.');
  }
  if (data.checklist?.damage_reported === true) {
    if (typeof data.incident?.description !== 'string' || data.incident.description.trim().length < 5 || !Array.isArray(data.photos?.DAMAGE) || data.photos.DAMAGE.length < 1 || data.photos.DAMAGE.length > 2) throw new Error('Décrivez la dégradation signalée et ajoutez une photo.');
  } else if (data.checklist?.no_new_damage !== true) throw new Error('Confirmez l’état du logement ou signalez une dégradation.');
}
