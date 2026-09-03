
async function requestAi<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "L’assistant IA est temporairement indisponible.");
  return payload as T;
}

export const aiService = {
  /**
   * Récupère les coordonnées d'une ville via l'IA si non présente dans le mock.
   */
  async getCityCoordinates(city: string): Promise<{ lat: number; lng: number } | null> {
    return requestAi<{ lat: number; lng: number } | null>('/api/ai/city-coordinates', { city });
  },

  /**
   * Génère une description d'annonce basée sur les caractéristiques du logement.
   */
  async generateListingDescription(data: any): Promise<string> {
    const response = await requestAi<{ description: string }>('/api/ai/listing-description', data);
    return response.description;
  }
};
