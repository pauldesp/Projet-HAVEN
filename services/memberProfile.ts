import { User, UserRole } from '../types';

type AuthMember = {
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  photoURL: string | null;
  emailVerified: boolean;
};

export function createPendingMemberProfile(authMember: AuthMember, emailFallback = ''): User {
  const nameParts = (authMember.displayName || '').trim().split(/\s+/).filter(Boolean);
  const displayName = authMember.displayName || 'Utilisateur';
  return {
    id: authMember.uid,
    firstName: nameParts[0] || 'Utilisateur',
    lastName: nameParts.slice(1).join(' ') || 'HAVEN',
    email: authMember.email || emailFallback,
    role: UserRole.TENANT,
    status: 'PENDING',
    avatarUrl: authMember.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1E293B&color=fff`,
    ...(authMember.phoneNumber ? { phone: authMember.phoneNumber } : {}),
    emailVerified: authMember.emailVerified,
    phoneVerified: Boolean(authMember.phoneNumber),
    identityVerified: false,
    isVerified: false,
    createdAt: new Date().toISOString(),
  };
}
