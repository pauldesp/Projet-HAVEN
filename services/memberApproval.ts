import { isVerificationReadyForAdminReview } from './profileVerification';

export class MemberApprovalError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}

export function prepareMemberApproval(
  profile: Parameters<typeof isVerificationReadyForAdminReview>[0] & { role?: unknown },
  actorId: string,
  now = new Date().toISOString()
) {
  if (profile.role !== 'TENANT' && profile.role !== 'OWNER') {
    throw new MemberApprovalError('La gestion des administrateurs passe par l’espace de gouvernance.', 403);
  }
  if (!isVerificationReadyForAdminReview(profile)) {
    throw new MemberApprovalError('Le dossier doit être complet et transmis, avec e-mail confirmé, téléphone renseigné, pièce d’identité et CG acceptées.');
  }
  return {
    status: 'APPROVED' as const,
    verificationException: null,
    identityVerified: true,
    isVerified: true,
    idVerifiedAt: now,
    identityReviewedBy: actorId,
    approvedAt: now,
    approvedBy: actorId,
    rejectionReason: null
  };
}

export function prepareMemberModeration(profile: { role?: unknown }, status: unknown, reason: unknown, actorId: string, now = new Date().toISOString()) {
  if (profile.role !== 'TENANT' && profile.role !== 'OWNER') throw new MemberApprovalError('La gestion des administrateurs passe par l’espace de gouvernance.', 403);
  if (status !== 'REJECTED' && status !== 'BANNED') throw new MemberApprovalError('Décision invalide.');
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 2000) throw new MemberApprovalError('Un motif de 1 à 2 000 caractères est obligatoire.');
  return {
    status, verificationException: null, rejectionReason: reason.trim(), identityVerified: false, isVerified: false,
    idVerifiedAt: null, verificationSubmittedAt: null, moderatedBy: actorId, moderatedAt: now
  };
}
