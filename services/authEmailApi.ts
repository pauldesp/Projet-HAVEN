import { authenticatedFetch } from './serverApi';

async function checkResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Impossible d’envoyer cet e-mail pour le moment.') as Error & { code?: string };
    if (response.status === 429) error.code = 'auth/too-many-requests';
    throw error;
  }
  return payload;
}
export async function requestVerificationEmail() {
  return checkResponse(await authenticatedFetch('/api/users/me/request-email-verification', { method: 'POST', body: '{}' }));
}
export async function requestPasswordResetEmail(email: string) {
  await checkResponse(await fetch('/api/auth/request-password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }));
}
