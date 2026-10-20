import type { InventoryReport } from '../types';

type Request = (url: string, init: RequestInit) => Promise<Response>;
const connectionError = (error: unknown) => error instanceof TypeError || (error instanceof Error && /load failed|failed to fetch|network|networkerror|connexion interrompue/i.test(error.message));

/** The report ID is stable across retries. The server returns its saved result. */
export async function submitInventoryReport(report: InventoryReport, request: Request, pause: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const url = `/api/bookings/${encodeURIComponent(report.bookingId)}/inventory`;
  const init = { method: 'POST', body: JSON.stringify({ report }) };
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try { response = await request(url, init); }
    catch (error) {
      if (!connectionError(error)) throw error;
      if (attempt < 2) { await pause(attempt === 0 ? 500 : 1500); continue; }
      throw new Error('La connexion avec Haven a été interrompue. Vos réponses sont conservées dans ce formulaire. Réessayez la validation sans fermer cette fenêtre.');
    }
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.report?.id === report.id && payload.report.bookingId === report.bookingId) return payload.report as InventoryReport;
    if (([502, 503, 504].includes(response.status) || response.ok) && attempt < 2) { await pause(attempt === 0 ? 500 : 1500); continue; }
    if (response.ok) throw new Error('La confirmation n’a pas pu être reçue. Vos réponses sont conservées. Réessayez la validation.');
    throw new Error(`${payload?.error || 'Impossible d’enregistrer l’état des lieux. Réessayez sans fermer le formulaire.'} (Erreur ${response.status})`);
  }
  throw new Error('Impossible de confirmer l’état des lieux. Réessayez sans fermer le formulaire.');
}
