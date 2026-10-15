const normalizeEmail = (value: string | null | undefined) => value?.trim().toLowerCase() || '';

/** Firebase's verified email or a recently redeemed one-time code proves ownership. */
export function canConfirmEmailOwnership(
  sessionEmail: string | null | undefined,
  firebaseEmail: string | null | undefined,
  firebaseVerified: boolean,
  codeTicketExpiresAt: number,
  now = Date.now(),
) {
  const email = normalizeEmail(sessionEmail);
  return Boolean(email && email === normalizeEmail(firebaseEmail) && (firebaseVerified || codeTicketExpiresAt > now));
}
