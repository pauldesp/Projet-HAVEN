const normalizeEmail = (value: string | null | undefined) => value?.trim().toLowerCase() || '';

/** Firebase must have verified the exact email of the signed-in account. */
export function canConfirmEmailOwnership(
  sessionEmail: string | null | undefined,
  firebaseEmail: string | null | undefined,
  firebaseVerified: boolean,
) {
  const email = normalizeEmail(sessionEmail);
  return Boolean(email && email === normalizeEmail(firebaseEmail) && firebaseVerified);
}
