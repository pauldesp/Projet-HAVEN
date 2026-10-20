import type { BookingAvailability } from '../types';

export async function loadAvailability(listingId?: string, signal?: AbortSignal): Promise<BookingAvailability[]> {
  const response = await fetch(`/api/availability${listingId ? `?listingId=${encodeURIComponent(listingId)}` : ''}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Impossible de vérifier les disponibilités. Réessayez dans un instant.');
  const data = await response.json();
  if (!Array.isArray(data.availability)) throw new Error('Disponibilités indisponibles.');
  return data.availability;
}
export function listenAvailability(listingId: string | undefined, callback: (items: BookingAvailability[]) => void, onError?: (error: Error) => void) {
  let active = true;
  let running = false;
  const controller = new AbortController();
  const refresh = async () => {
    if (!active || running) return;
    running = true;
    try { const items = await loadAvailability(listingId, controller.signal); if (active) callback(items); }
    catch (error) { if (active) onError?.(error instanceof Error ? error : new Error('Disponibilités indisponibles.')); }
    finally { running = false; }
  };
  void refresh();
  const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15_000);
  const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
  window.addEventListener('focus', onVisible);
  document.addEventListener('visibilitychange', onVisible);
  return () => { active = false; controller.abort(); clearInterval(timer); window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible); };
}
