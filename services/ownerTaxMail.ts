import { withLayout } from './reservationMail';
import { daysLeft, type OwnerTaxRequest } from './ownerTaxRequest';

/**
 * Asking an owner for their status and tax details, after their first paid booking. Plain, short, reassuring:
 * payouts go on during the 60 days; only the last reminder mentions what happens afterwards.
 */
export function ownerTaxRequestEmail(reminder: number, firstName: string, request: OwnerTaxRequest, appOrigin?: string, now = Date.now()) {
  const deadline = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(new Date(request.deadlineAt));
  const subject = reminder === 0 ? 'Votre première réservation payée : une dernière information'
    : reminder === 1 ? 'Rappel : votre statut et votre numéro fiscal'
    : 'Dernier rappel : votre statut et votre numéro fiscal';
  const body = reminder === 0
    ? `Félicitations pour votre première réservation payée sur Haven !\n\nPour vous verser vos revenus, la loi nous demande de connaître votre statut (particulier ou professionnel) et votre numéro fiscal, qui figure sur votre avis d’impôt. Cela prend 2 minutes, dans l’onglet Finances de votre espace propriétaire ; nous avons déjà repris les informations de votre profil.\n\nVos versements continuent normalement en attendant. Merci de compléter ces informations avant le ${deadline}.`
    : reminder === 1
      ? `Il vous reste ${daysLeft(request, now)} jours pour indiquer votre statut et votre numéro fiscal, dans l’onglet Finances de votre espace propriétaire. Cela prend 2 minutes.\n\nVos versements continuent normalement d’ici le ${deadline}.`
      : `Sans votre statut et votre numéro fiscal au ${deadline}, la loi nous oblige à suspendre vos versements jusqu’à ce qu’ils soient renseignés. Ils reprendront aussitôt après.\n\nCela prend 2 minutes, dans l’onglet Finances de votre espace propriétaire.`;
  const text = `Bonjour${firstName ? ` ${firstName}` : ''},\n\n${body}\n\nL’équipe Haven`;
  return withLayout(subject, text, { listingTitle: 'Haven' }, appOrigin, 'Compléter mes informations', '/owner/dashboard?tab=finances');
}
