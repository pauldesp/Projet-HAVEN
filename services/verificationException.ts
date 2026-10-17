export interface VerificationException {
  decisionId: string;
  grantedBy: string;
  grantedAt: string;
  reason: string;
}
export class VerificationExceptionError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
export function hasVerificationException(profile: { status?: unknown; verificationException?: unknown }): boolean {
  const value = profile.verificationException as Partial<VerificationException> | null | undefined;
  return profile.status === 'APPROVED' && Boolean(value && typeof value.decisionId === 'string' && value.decisionId && typeof value.grantedBy === 'string' && value.grantedBy && typeof value.grantedAt === 'string' && value.grantedAt && typeof value.reason === 'string' && value.reason.trim());
}
export function hasTrustedVerificationException(profile: { status?: unknown; verificationException?: unknown }, record: { active?: unknown; decisionId?: unknown; subjectId?: unknown } | undefined, userId: string): boolean {
  return hasVerificationException(profile) && record?.active === true && record.subjectId === userId && record.decisionId === (profile.verificationException as VerificationException).decisionId;
}
export function prepareVerificationException(targetType: unknown, target: { role?: unknown; verificationException?: unknown }, actor: { uid: string; level: string }, mode: unknown, reason: unknown, decisionId: string, now = new Date().toISOString()) {
  if (actor.level !== 'PRIMARY') throw new VerificationExceptionError('Cette dérogation est réservée à l’administrateur principal.', 403);
  if (targetType !== 'USER' && targetType !== 'LISTING') throw new VerificationExceptionError('Élément invalide.');
  if (targetType === 'USER' && target.role !== 'TENANT' && target.role !== 'OWNER') throw new VerificationExceptionError('Une dérogation ne peut pas attribuer des droits administrateur.', 403);
  if (mode !== 'GRANT' && mode !== 'REVOKE') throw new VerificationExceptionError('Décision invalide.');
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 2000) throw new VerificationExceptionError('Un motif de 1 à 2 000 caractères est obligatoire.');
  if (mode === 'REVOKE' && !target.verificationException) throw new VerificationExceptionError('Aucune dérogation à retirer.');
  return mode === 'GRANT'
    ? { status: 'APPROVED' as const, verificationException: { decisionId, grantedBy: actor.uid, grantedAt: now, reason: reason.trim() }, rejectionReason: null }
    : { status: 'PENDING' as const, verificationException: null, rejectionReason: null };
}
