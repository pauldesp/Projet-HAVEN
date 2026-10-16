interface EmailAccount {
  uid: string;
  email: string | null;
  emailVerified: boolean;
}

export const EMAIL_RESEND_DELAY_MS = 60_000;
export const EMAIL_LIMIT_BACKOFF_MS = 5 * 60_000;

export function emailRetrySeconds(retryAt: number, now = Date.now()): number {
  return Number.isFinite(retryAt) ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0;
}

interface VerificationActions {
  reload: () => Promise<void>;
  send: () => Promise<void>;
  confirm: () => Promise<void>;
}

function assertSameAccount(account: EmailAccount, profile: { id: string; email: string }) {
  if (account.uid !== profile.id || account.email?.trim().toLowerCase() !== profile.email.trim().toLowerCase()) {
    throw new Error('Votre session ne correspond pas à cette adresse. Reconnectez-vous puis réessayez.');
  }
}

export async function requestAccountEmailVerification(
  account: EmailAccount,
  profile: { id: string; email: string },
  actions: VerificationActions,
): Promise<'sent' | 'confirmed'> {
  assertSameAccount(account, profile);
  await actions.reload();
  if (account.emailVerified) {
    await actions.confirm();
    return 'confirmed';
  }
  await actions.send();
  return 'sent';
}

export async function finishAccountEmailVerification(
  account: EmailAccount,
  profile: { id: string; email: string },
  actions: Pick<VerificationActions, 'reload' | 'confirm'>,
): Promise<boolean> {
  assertSameAccount(account, profile);
  await actions.reload();
  if (!account.emailVerified) return false;
  await actions.confirm();
  return true;
}
